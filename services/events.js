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
    }
}

module.exports = new EventService();