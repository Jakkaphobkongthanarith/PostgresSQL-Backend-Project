import express from "express";
import "dotenv/config";
import connectionPool from "./utils/db.mjs";
const app = express();
const port = 4000;

app.use(express.json());
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "get rekt" }); // Custom error message for JSON parsing errors
  }
  next();
});

app.get("/test", (req, res) => {
  return res.json("Server API is working 🚀");
});

app.post("/questions", async (req, res) => {
  const newQuestion = {
    ...req.body,
    created_at: new Date(),
    updated_at: new Date(),
  };
  if (!newQuestion) {
    return req.status(400).json({
      message: "Missing or invalid request data",
    });
  }
  try {
    await connectionPool.query(
      `insert into questions (title, description, category, created_at, updated_at)
      values ($1, $2, $3, $4, $5)
      returning *`,
      [
        newQuestion.title,
        newQuestion.description,
        newQuestion.category,
        newQuestion.created_at,
        newQuestion.updated_at,
      ]
    );
    return res.status(201).json({
      message: "Question created successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Connection to server error",
    });
  }
});

app.post("/questions/:id/answers", async (req, res) => {
  const questionId = req.params.id;
  const newPost = {
    ...req.body,
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (!newPost.content) {
    return res.status(400).json({ message: "Missing content in request body" });
  }

  try {
    const result = await connectionPool.query(
      `insert into answers (question_id, content, created_at, updated_at)
     values ($1, $2, $3, $4)
     returning *`,
      [questionId, newPost.content, newPost.created_at, newPost.updated_at]
    );

    return res.status(201).json({
      message: "Answer created successfully.",
      answer: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating answer:", error);
    return res.status(500).json({
      message: "Connection to server error",
    });
  }
});

app.get("/questions", async (req, res) => {
  const { title, category } = req.query;
  let searchQuery = `select * from questions `;
  let searchHolder = [];

  if (title || category) {
    const conditions = [];
    if (title) {
      conditions.push(`title ILIKE $${searchHolder.length + 1}`);
      searchHolder.push(`%${title}%`);
    }
    if (category) {
      conditions.push(`category ILIKE $${searchHolder.length + 1}`);
      searchHolder.push(`%${category}%`);
    }
    searchQuery = searchQuery + ` where ${conditions.join(" and ")}`;
  } else {
    return res.status(400).json({ message: "Invalid query parameters" });
  }

  try {
    console.log(category.length);
    const results = await connectionPool.query(searchQuery, searchHolder);
    return res.status(200).json({
      message: "Successfully retrieved the list of questions.",
      data: results.rows,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Server could not get question because database connection",
    });
  }
});

app.get("/questions/:id", async (req, res) => {
  let results;
  try {
    const questionIdFromClient = req.params.id;

    results = await connectionPool.query(
      `select * from questions where id = $1`,
      [questionIdFromClient]
    );
    console.log("404 results", results);
    if (results.rowCount == 0) {
      return res.status(404).json({
        message: "Question not found",
      });
    }
    return res.status(200).json({
      message: "Successfully retrieved the question",
      data: results.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read question because database connection",
    });
  }
});

app.get("/questions/:id/answers", async (req, res) => {
  let results;
  try {
    const questionIdFromClient = req.params.id;

    results = await connectionPool.query(
      `select * from answers where id = $1`,
      [questionIdFromClient]
    );
    console.log("404 results", results);
    if (results.rowCount == 0) {
      return res.status(404).json({
        message: "Question not found",
      });
    }
    return res.status(200).json({
      message: "Successfully retrieved the question",
      data: results.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read question because database connection",
    });
  }
});

app.put("/questions/:id", async (req, res) => {
  const questionIdFromClient = req.params.id;
  const { title, description, category } = req.body;

  console.log(title);
  if (!title || !description || !category) {
    return res.status(400).json({
      message: "Missing or invalid request data",
    });
  }

  const updatedQuesions = {
    ...req.body,
    updated_at: new Date(),
  };
  try {
    const updateResult = await connectionPool.query(
      `
      update questions
      set title = $2,
          description = $3,
          category = $4,
          updated_at = $5
      where id = $1
      `,
      [
        questionIdFromClient,
        updatedQuesions.title,
        updatedQuesions.description,
        updatedQuesions.category,
        updatedQuesions.updated_at,
      ]
    );
    if (updateResult.rowCount == 0) {
      return res.status(404).json({
        message: "Question not found",
      });
    }
    return res
      .status(200)
      .json({ message: "Successfully updated the question." });
  } catch (error) {
    console.error("Error updating question:", error);
    return res.status(500).json({
      message: "Server could not update question due to a database error",
    });
  }
});

app.put("/questions/:id/answers", async (req, res) => {
  const questionId = req.params.id;
  const editAnswer = { ...req.body, updated_at: new Date() };
  if (!editAnswer) {
    return res.status(400).json({ message: "Missing or invalid request data" });
  }

  try {
    const updateAnswer = await connectionPool.query(
      `
      update answers
      set content = $1, updated_at = $2
      where id = $3
      returning *;
    `,
      [editAnswer.content, editAnswer.updated_at, questionId]
    );

    if (updateAnswer.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Answer not found for the given question ID" });
    }

    res.status(200).json({
      message: "Successfully updated the answer",
      answer: updateAnswer.rows[0],
    });
  } catch (error) {
    console.error("Error updating answer:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/questions/:id", async (req, res) => {
  const questionIdFromClient = req.params.id;

  try {
    const delChara = await connectionPool.query(
      `delete from questions where id = $1`,
      [questionIdFromClient]
    );
    if (delChara.rowCount == 0) {
      return res.status(404).json({
        message: "Question not found",
      });
    }
  } catch (error) {
    console.error("Error updating question:", error);
    return res.status(500).json({
      message: "Server could not delete question because database connection",
    });
  }
  return res.status(200).json({
    message: "Question and its answers deleted successfully.",
  });
});

app.delete("/answers/:id", async (req, res) => {
  const questionIdFromClient = req.params.id;

  try {
    const delCharaQuestions = await connectionPool.query(
      `delete from answers where id = $1`,
      [questionIdFromClient]
    );
    console.log(delCharaQuestions);
    if (delCharaQuestions.rowCount === 0) {
      return res.status(404).json({
        message:
          "Either Question or Answer not found คุณมิวเช็คหน่อยค้าบว่าควรเขียนยังไงดี",
      });
    }
  } catch (error) {
    console.error("Error delete question:", error);
    return res.status(500).json({
      message: "Server could not delete question because database connection",
    });
  }
  return res.status(200).json({
    message: "Delete question successfully",
  });
});
app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});
// answer id:
//
//
// WITH deleted_comments AS (
//   DELETE FROM comments
//   WHERE post_id = 1
//   RETURNING post_id
// )
// DELETE FROM posts
// WHERE id IN (SELECT post_id FROM deleted_comments);WITH deleted_comments AS (
//   DELETE FROM comments
//   WHERE post_id = 1
//   RETURNING post_id
// )
// DELETE FROM posts
// WHERE id IN (SELECT post_id FROM deleted_comments);
