const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class EventService {
    async createEvent(eventData){
        const { name, description, location, startTime, endTime, capacity, points } = eventData;

        const event = await prisma.event.create({
            data: {
                name,
                description,
                location,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                capacity,
                points,
                pointsRemain: points,
                pointsAwarded: 0,
                published: false
            },
            include: {
                organizers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                utorid: true,
                                name: true,
                            }
                        }
                    }
                },
                guests: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                utorid: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        return event;
    }

    async getEvents(filters, userRole) {
        const { name, location, started, ended, showFull, published, page = 1, limit = 10 } = filters;

        const where = {};
        const now = new Date();

        if (userRole == "regular") {
            where.published = true;
        } else if (published !== undefined) {
            where.published = published === 'true';
        }

        if (name) {
            where.name = { contains: name};
        }
        if (location) {
            where.location = { contains: location};
        }
        if (started === 'true') {
            where.startTime = { lte: now };
        } else if (started === 'false') {
            where.startTime = { gt: now };
        }
        if (ended === 'true') {
            where.endTime = { lte: now };
        } else if (ended === 'false') {
            where.endTime = { gt: now };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [count, events] = await Promise.all([
            prisma.event.count({ where }),
            prisma.event.findMany({
                where,
                skip,
                take,
                include: {
                    guests: true
                }
            })
        ]);

        let filteredEvents = events;
        if (showFull === 'false') {
            filteredEvents = events.filter(event => {
                if (event.capacity === null) return true;
                return event.guests.length < event.capacity;
            });
        }

        return { count, events: filteredEvents };
    }

    async getEventById(eventId) {
        const event = await prisma.event.findUnique({
            where: { id:parseInt(eventId) },
            include: {
                organizers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                utorid: true,
                                name: true,
                            }
                        }
                    }
                },
                guests: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                utorid: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        return event;
    }

    async updateEvent(eventId, updates, currentEvent) {
        const updateData = {};

        if (updates.points !== undefined) {
            const pointsDiff = updates.points - currentEvent.points;
            updateData.points = updates.points;
            updateData.pointsRemain = currentEvent.pointsRemain + pointsDiff;
        }

        if (updates.name) updateData.name = updates.name;
        if (updates.description) updateData.description = updates.description;
        if (updates.location) updateData.location = updates.location;
        if (updates.startTime) updateData.startTime = new Date(updates.startTime);
        if (updates.endTime) updateData.endTime = new Date(updates.endTime);
        if (updates.capacity !== undefined) updateData.capacity = updates.capacity;
        if (updates.published !== undefined) updateData.published = updates.published;

        const updatedEvent = await prisma.event.update({
            where: { id: parseInt(eventId) },
            data: updateData,
        });

        return updatedEvent;
    }

    async deleteEvent(eventId) {
        await prisma.event.delete({
            where: { id: parseInt(eventId) },
        });
    }

    async isEventOrganizer(eventId, userId) {
        const organizer = await prisma.eventOrganizer.findFirst({
            where: {
                eventId: parseInt(eventId),
                userId: parseInt(userId)
            }
        });
        return !!organizer;
    }

    async addOrganizer(eventId, userId) {
        await prisma.eventOrganizer.create({
            data: {
                eventId: parseInt(eventId),
                userId: parseInt(userId)
            }
        });

        const updatedEvent = await prisma.event.findUnique({
            where: { id: parseInt(eventId) },
            include: {
                organizers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                utorid: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });
        return updatedEvent;
    }

    async removeOrganizer(eventId, userId) {
        const organizer = await prisma.eventOrganizer.findFirst({
            where: {
                eventId: parseInt(eventId),
                userId: parseInt(userId)
            }
        });

        if (!organizer) {
            return null;
        }

        await prisma.eventOrganizer.delete({
            where: { id: organizer.id }
        });
        return true;
    }

    async isEventGuest(eventId, userId) {
        const guest = await prisma.eventGuest.findFirst({
            where: {
                eventId: parseInt(eventId),
                userId: parseInt(userId)
            }
        });
        return !!guest;
    }

    async addGuest(eventId, userId) {
        await prisma.eventGuest.create({
            data: {
                eventId: parseInt(eventId),
                userId: parseInt(userId)
            }
        });
    }

    async removeGuest(eventId, userId) {
        const guest = await prisma.eventGuest.findFirst({
            where: {
                eventId: parseInt(eventId),
                userId: parseInt(userId)
            }
        });

        if (!guest) {
            return null;
        }

        await prisma.eventGuest.delete({
            where: { id: guest.id }
        });
        return true;
    }

    async getUserByUtorid(utorid) {
        const user = await prisma.user.findUnique({
            where: { utorid }
        });
        return user;
    }

    async getUserById(userId) {
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });
        return user;
    }

    async createEventTransaction(eventId, userId, amount, createdById, remark) {
        const transaction = await prisma.transaction.create({
            data: {
                type: 'event',
                amount,
                eventId: parseInt(eventId),
                userId: parseInt(userId),
                createdById: parseInt(createdById),
                remark
            }
        });

        await prisma.event.update({
            where: { id: parseInt(eventId) },
            data: {
                pointsRemain: { 
                    decrement: amount 
                },
                pointsAwarded: {
                    increment: amount
                }
            }
        });

        return transaction;
    }

    async createBulkEventTransactions(eventId, guests, amount, createdById, remark) {
        const totalAmount = amount * guests.length;
        const transactions = [];

        for (const guest of guests) {
            const transaction = await this.createEventTransaction(
                eventId,
                guest.userId,
                amount,
                createdById,
                remark
            );
            transactions.push(transaction);
        }

        return transactions;
    }

}

module.exports = new EventService();