const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const createEvent = async (req, res) => {
    try {
        const { name, description, location, startTime, endTime, capacity, points } = req.body;

        if (!name || !description || !location || !startTime || !endTime || !points) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        if (end <= start) {
            return res.status(400).json({ message: "End time must be after start time" });
        }

        const event = await prisma.event.create({
            data: {
                name,
                description,
                location,
                startTime: start,
                endTime: end,
                capacity: capacity ?? null,
                points,
                pointsRemain: points,
            },
        });

        res.status(201).json({
            ...event,
            organizers: [],
            guests: [],
        });
    } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


module.exports = { createEvent };