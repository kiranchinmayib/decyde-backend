import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Health check - Render pings this
app.get("/health", (req, res) => {
res.status(200).json({ status: "ok" });
});

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
  cheapest: {
    app: "Zepto",
    estimate: "₹240",
    explanation: "Based on recent price trends"
  },
  fastest: {
    app: "Blinkit",
    estimate: "15 mins",
    explanation: "Closest delivery partner available"
  },
  best_balance: {
    app: "Instamart",
    estimate: "₹255 • 20 mins",
    explanation: "Balanced price and delivery time"
  },
  confidence: "low"
});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
console.log(`Server running on port ${PORT}`);
});
