import express from "express";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());
app.use(express.json());

// Upload & process video
// Upload & process video
app.post("/upload", upload.single("video"), (req, res) => {
  const { ideal_answer } = req.body;
  const filePath = req.file.path;

  const pythonPath = "C:\\Users\\yasmi\\AppData\\Local\\Programs\\Python\\Python313\\python.exe";
  const scriptPath = path.join(__dirname, "compare.py");

  const py = spawn(pythonPath, [scriptPath, filePath, ideal_answer]);

  let output = "";
  py.stdout.on("data", data => {
    console.log("🔹 Python stdout:", data.toString());
    output += data.toString();
  });
  py.stderr.on("data", data => console.error("🔴 Python stderr:", data.toString()));

  py.on("close", () => {
    fs.unlinkSync(filePath);

    try {
      const jsonOutput = JSON.parse(output);
      // Send both raw and polished transcripts
      res.json({
        raw_transcript: jsonOutput.raw_transcript,
        polished_transcript: jsonOutput.polished_transcript,
        similarity: jsonOutput.similarity
      });
    } catch (e) {
      res.status(500).json({ error: "Python script failed", details: output });
    }
  });
});


// Start server
app.listen(5000, () => console.log("✅ Server running on http://127.0.0.1:5000"));
