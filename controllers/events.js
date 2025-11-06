const e = require('express');
const eventService = require('../services/events');

class EventController {
    async createEvent(req, res) {
        try {
            const { name, description, location, startTime, endTime, capacity, points } = req.body;

            if (!name || !description || !location || !startTime || !endTime || !points) {
                return res.status(400).json({ message: "All fields are required" });
            }

            const start = new Date(startTime);
            const end = new Date(endTime);
            const now = new Date();
            if (start < now || end < now) {
                return res.status(400).json({ message: "Event times must be in the future" });
            }
            if (end <= start) {
                return res.status(400).json({ message: "End time must be after start time" });
            }
            if (capacity !== null && capacity !== undefined && capacity <= 0){
                return res.status(400).json({ message: "Capacity must be a positive number" });
            }
            if (points <= 0 || !Number.isInteger(points)){
                return res.status(400).json({ message: "Points must be a positive integer" });
            }

            const event = await eventService.createEvent({
                name,
                description,
                location,
                startTime,
                endTime,
                capacity,
                points
            });

            res.status(201).json({
                id: event.id,
                name: event.name,
                description: event.description,
                location: event.location,
                startTime: event.startTime,
                endTime: event.endTime,
                capacity: event.capacity,
                points: event.points,
                pointsRemain: event.pointsRemain,
                pointsAwarded: event.pointsAwarded,
                published: event.published,
                organizers: event.organizers.map(org => ({
                    id: org.user.id,
                    utorid: org.user.utorid,
                    name: org.user.name,
                })),
                guests: []
            });
        } catch (error) {
            console.error("Error creating event:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    };

    async getEvents(req, res) {
        try {
            const { started, ended } = req.query;
            const userRole = req.auth?.role || 'regular';

            if (started !== undefined && ended !== undefined) {
                return res.status(400).json({ message: "Cannot filter by both started and ended" });
            }

            const { count, events } = await eventService.getEvents(req.query, userRole);

            const results = events.map(event => {
                const result = {
                    id: event.id,
                    name: event.name,
                    location: event.location,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    capacity: event.capacity,
                    numGuests: event.guests.length,
                };

                if (userRole !== 'regular') {
                    result.pointsRemain = event.pointsRemain;
                    result.pointsAwarded = event.pointsAwarded;
                    result.published = event.published;
                }
                return result;
            });

            res.status(200).json({ count, results });
        } catch (error) {
            console.error("Error fetching events:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async getEvent(req, res) {
        try {
            const { eventId } = req.params;
            const userRole = req.auth?.role || 'regular';
            const userId = req.userId;
            const event = await eventService.getEventById(eventId);

            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }

            if (userRole === 'regular' && !event.published) {
                return res.status(403).json({ message: "Access denied" });
            }

            const isOrganizer = userId && await eventService.isEventOrganizer(eventId, userId);
            const response = {
                id: event.id,
                name: event.name,
                description: event.description,
                location: event.location,
                startTime: event.startTime.toISOString(),
                endTime: event.endTime.toISOString(),
                capacity: event.capacity,
                organizers: event.organizers.map(org => ({
                    id: org.user.id,
                    utorid: org.user.utorid,
                    name: org.user.name,
                })),
            }

            if (userRole === 'regular' && !isOrganizer) {
                response.numGuests = event.guests.length;
            } else {
                response.pointsRemain = event.pointsRemain;
                response.pointsAwarded = event.pointsAwarded;
                response.published = event.published;
                response.guests = event.guests.map(guest => ({
                    id: guest.user.id,
                    utorid: guest.user.utorid,
                    name: guest.user.name,
                }));
            }

            res.status(200).json(response);
        } catch (error) {
            console.error("Error fetching event:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async updateEvent(req, res) {
        try {
            const { eventId } = req.params;
            const userRole = req.auth?.role;
            const updates = req.body;

            const event = await eventService.getEventById(eventId);
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }

            const now = new Date();

            if (updates.points !== undefined) {
                const isManager = ['manager', 'superuser'].includes(userRole);
                if (!isManager) {
                    return res.status(403).json({ message: "Only managers can update points" });
                }
                if (!Number.isInteger(udpates.points) || udpates.points <= 0) {
                    return res.status(400).json({ message: "Points must be a positive integer" });
                }
                const pointsDiff = udpates.points - event.points;
                if (event.pointsRemain + pointsDiff < 0) {
                    return res.status(400).json({ message: "Insufficient remaining points for this update" });
                }
            }

            if (updates.published !== undefined) {
                const isManager = ['manager', 'superuser'].includes(userRole);
                if (!isManager) {
                    return res.status(403).json({ message: "Only managers can update published status" });
                }
                if (updates.published !== true) {
                    return res.status(400).json({ message: "Published can only be set to true" });
                }
            }

            const newStartTime = updates.startTime ? new Date(updates.startTime) : event.startTime;
            const newEndTime = updates.endTime ? new Date(updates.endTime) : event.endTime;

            if (newStartTime < now || newEndTime < now) {
                return res.status(400).json({ message: "Event times must be in the future" });
            }
            if (newEndTime <= newStartTime) {
                return res.status(400).json({ message: "End time must be after start time" });
            }

            const restrictedFields = ['name', 'description', 'location', 'startTime', 'endTime', 'capacity'];
            const hasRestrictedUpdates = restrictedFields.some(field => updates[field] !== undefined);

            if (hasRestrictedUpdates && event.startTime < now) {
                return res.status(400).json({ message: "Cannot update name, description, location, startTime, endTime, or capacity of an event that has already started" });
            }
            if (updates.endTime !== undefined && event.endTime < now) {
                return res.status(400).json({ message: "Cannot update endTime of an event that has already ended" });
            }

            if (updates.capacity !== undefined) {
                if (updates.capacity !== null && updates.capacity <= 0) {
                    return res.status(400).json({ message: "Capacity must be a positive number" });
                }
                if (updates.capacity !== null && updates.capacity < event.guests.length) {
                    return res.status(400).json({ message: "Capacity cannot be less than current number of guests" });
                }
            }

            const updatedEvent = await eventService.updateEvent(eventId, updates, event);

            const response = {
                id: updatedEvent.id,
                name: updatedEvent.name,
                location: updatedEvent.location,
            };

            Object.keys(updates).forEach(key => {
                if (key === 'startTime' && updates.startTime) {
                    response.startTime = updatedEvent.startTime.toISOString();
                } else if (key === 'endTime' && updates.endTime) {
                    response.endTime = updatedEvent.endTime.toISOString();
                } else if (key === 'publisehd' && updates.published !== undefined) {
                    response.published = updatedEvent.published;
                } else if (key === 'points' && updates.points !== undefined) {
                    response.points = updatedEvent.points;
                    response.pointsRemain = updatedEvent.pointsRemain;
                } else if (['description', 'capacity'], key.includes(key) && updates[key] !== undefined) {
                    response[key] = updatedEvent[key];
                }
           });
            res.status(200).json(response);
        } catch (error) {
            console.error("Error updating event:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async deleteEvent(req, res) {
        try {
            const { eventId } = req.params;
            const event = await eventService.getEventById(eventId);
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }
            if (event.published) {
                return res.status(400).json({ message: "Cannot delete a published event" });
            }

            await eventService.deleteEvent(eventId);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting event:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async addOrganizer(req, res) {
        try {
            const { eventId } = req.params;
            const { utorid } = req.body;

            if (!utorid) {
                return res.status(400).json({ message: "utorid is required" });
            }
            const event = await eventService.getEventById(eventId);
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }
            if (event.endTime < new Date()) {
                return res.status(410).json({ message: "Cannot add organizers to an event that has already ended" });
            }

            const user = await eventService.getUserByUtorid(utorid);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const isGuest = await eventService.isEventGuest(eventId, user.id);
            if (isGuest) {
                return res.status(400).json({ message: "User is already a guest of the event" });
            }

            const updatedEvent = await eventService.addOrganizer(eventId, user.id);
            res.status(201).json({
                id: updatedEvent.id,
                name: updatedEvent.name,
                location: updatedEvent.location,
                organizers: updatedEvent.organizers.map(org => ({
                    id: org.user.id,
                    utorid: org.user.utorid,
                    name: org.user.name,
                }))
            });
        } catch (error) {
            console.error("Error adding organizer:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async removeOrganizer(req, res) {
        try {
            const { eventId, userId } = req.params;

            const result = await eventService.removeOrganizer(eventId, userId);
            if (!result) {
                return res.status(404).json({ message: "Organizer not found for this event" });
            }
            res.status(204).send();
        } catch (error) {
            console.error("Error removing organizer:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async addGuest(req, res) {
        try {
            const { eventId } = req.params;
            const { utorid } = req.body;
            const userId = req.userId;
            if (!utorid) {
                return res.status(400).json({ message: "utorid is required" });
            }

            const event = await eventService.getEventById(eventId);
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }

            const isOrganizer = userId && await eventService.isEventOrganizer(eventId, userId);
            if (isOrganizer && !event.published) {
                return res.status(403).json({ message: "Access denied" });
            }
            if (event.endTime < new Date()) {
                return res.status(410).json({ message: "Cannot add guests to an event that has already ended" });
            }
            if (event.capacity !== null && event.guests.length >= event.capacity) {
                return res.status(410).json({ message: "Event capacity reached" });
            }

            const user = await eventService.getUserByUtorid(utorid);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const exisitngOrganizer = await eventService.isEventOrganizer(eventId, user.id);
            if (exisitngOrganizer) {
                return res.status(400).json({ message: "User is already an organizer of the event" });
            }

            await eventService.addGuest(eventId, user.id);

            res.status(201).json({
                id: event.id,
                name: event.name,
                location: event.location,
                guestAdded: {
                    id: user.id,
                    utorid: user.utorid,
                    name: user.name,
                },
                numGuests: event.guests.length + 1,
            });
        } catch (error) {
            console.error("Error adding guest:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async removeGuest(req, res) {
        try {
            const { eventId, userId } = req.params;

            const result = await eventService.removeGuest(eventId, userId);
            if (!result) {
                return res.status(404).json({ message: "Guest not found for this event" });
            }
            res.status(204).send();
        } catch (error) {
            console.error("Error removing guest:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async rsvpToEvent(req, res) {
        try {
            const { eventId } = req.params;
            const userId = req.userId;
            const event = await eventService.getEventById(eventId);

            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }
            if (!event.published) {
                return res.status(404).json({ message: "Cannot RSVP to an unpublished event" });
            }
            if (event.endTime < new Date()) {
                return res.status(410).json({ message: "Cannot RSVP to an event that has already ended" });
            }
            if (event.capacity !== null && event.guests.length >= event.capacity) {
                return res.status(410).json({ message: "Event capacity reached" });
            }

            const isGuest = await eventService.isEventGuest(eventId, userId);
            if (isGuest) {
                return res.status(400).json({ message: "User is already a guest of the event" });
            }

            const user = await eventService.getUserById(userId);

            await eventService.addGuest(eventId, userId);

            res.status(201).json({
                id: event.id,
                name: event.name,
                location: event.location,
                guestAdded: {
                    id: userId,
                    utorid: user.utorid,
                    name: user.name,
                },
                numGuests: event.guests.length + 1,
            });
        } catch (error) {
            console.error("Error RSVPing to event:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async removeRsvp(req, res) {
        try {
            const { eventId } = req.params;
            const userId = req.userId;
            const event = await eventService.getEventById(eventId);

            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }
            if (event.endTime < new Date()) {
                return res.status(410).json({ message: "Cannot remove RSVP from an event that has already ended" });
            }

            const result = await eventService.removeGuest(eventId, userId);
            if (!result) {
                return res.status(404).json({ message: "Guest not found for this event" });
            }
            res.status(204).send();
        } catch (error) {
            console.error("Error removing RSVP:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

    async awardPoints(req, res) {
        try {
            const { eventId } = req.params;
            const { type, utorid, amount } = req.body;
            const userId = req.userId;

            if (type !== 'event') {
                return res.status(400).json({ message: "Invalid award type" });
            }
            if (!amount || !Number.isInteger(amount) || amount <= 0) {
                return res.status(400).json({ message: "Amount must be a positive integer" });
            }

            const event = await eventService.getEventById(eventId);
            if (!event) {
                return res.status(404).json({ message: "Event not found" });
            }

            const creator = await eventService.getUserById(userId);
            const remark = req.body.remark || event.name;
            if (utorid) {
                const recipient = event.guests.find(guest => guest.user.utorid === utorid);
                if (!recipient) {
                    return res.status(404).json({ message: "User is not a guest of the event" });
                }
                if (event.pointsRemain < amount) {
                    return res.status(400).json({ message: "Insufficient event points remaining" });
                }

                const transaction = await eventService.createEventTransaction(eventId, recipient.user.id, amount, userId, remark);

                res.status(201).json({
                    id: transaction.id,
                    recipient: recipient.user.utorid,
                    awarded: amount,
                    type: 'event',
                    relatedId: parseInt(eventId),
                    remark: transaction.remark,
                    createdBy: creator.utorid,
                });
            } else {
                const totalAmount = amount * event.guests.length;
                if (event.pointsRemain < totalAmount) {
                    return res.status(400).json({ message: "Insufficient event points remaining" });
                }

                const transactions = await eventService.createBulkEventTransactions(eventId, event.guests, amount, userId, remark);
                const response = transactions.map((transaction, index) => ({
                    id: transaction.id,
                    recipient: event.guests[index].user.utorid,
                    awarded: amount,
                    type: 'event',
                    relatedId: parseInt(eventId),
                    remark: transaction.remark,
                    createdBy: creator.utorid,
                }));
                res.status(201).json(response);
            }
        } catch (error) {
            console.error("Error awarding points:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

}

module.exports = new EventController();