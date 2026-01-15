module.exports = {
  async up(db) {
    await db.createCollection("users", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["username", "password"],
          properties: {
            username: {
              bsonType: "string",
              description: "must be a string and is required",
            },
            password: {
              bsonType: "string",
              description: "must be a string and is required",
            }
          },
        },
      },
    });
    await db.collection("users").createIndex({ "username": 1 }, { unique: true });
  },

  async down(db) {
    await db.collection("users").drop();
  }
};
