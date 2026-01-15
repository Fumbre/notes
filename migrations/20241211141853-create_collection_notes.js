module.exports = {
  async up(db) {
    await db.createCollection("notes", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId"],
          properties: {
            userId: {
              bsonType: "objectId",
              description: "User id. must be an ObjectId and is required",
            },
            title: {
              bsonType: "string",
              description: "Title of note. Optional field, must be a string",
            },
            text: {
              bsonType: "string",
              description: "Text of note. Optional field, must be a string",
            },
            archivedAt: {
              bsonType: ["date", "null"],
              description: "Archived timestamp. Optional field, can be null or a date",
            },
          },
        },
      },
    });

    await db.collection("notes").createIndex({ "userId": 1, "archivedAt": 1 });
  },

  async down(db) {
    await db.collection("notes").drop();
  }
};
