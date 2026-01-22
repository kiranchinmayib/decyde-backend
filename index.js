import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Decyde Backend Running");
});

// Compare endpoint
app.post("/compare", (req, res) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items provided" });
  }

  res.json({
    cheapest: { app: "Zepto", estimate: "₹240" },
    fastest: { app: "Blinkit", estimate: "15 mins" },
    best_balance: { app: "Instamart", estimate: "₹255 • 20 mins" },
    confidence: "low"
  });
});

app.listen(process.env.PORT || 3000);
