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
}

module.exports = new EventController();