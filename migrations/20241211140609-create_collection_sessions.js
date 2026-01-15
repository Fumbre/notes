module.exports = {
  async up(db) {
    await db.createCollection("sessions", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId"],
          properties: {
            userId: {
              bsonType: "objectId",
              description: "User id. must be an ObjectId and is required",
            }
          },
        },
      },
    });
  },

  async down(db) {
    await db.collection("sessions").drop();
  }
};
