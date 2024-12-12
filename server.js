const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const shortid = require("shortid");

const app = express();
const PORT = 5000;

// Middleware per te procesuar JSON
app.use(bodyParser.json());

// Sherbimi i skedareve statike
app.use(express.static(__dirname));

// Lidhja me bazen e te dhenave
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "url_shortener",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Lidhja me bazen e te dhenave u realizua me sukses!");
});

// Endpoint per te shkurtesuar URL
app.post("/shorten", (req, res) => {
  const { long_url, expiration_select } = req.body;

  if (!long_url) {
    return res.status(400).json({ error: "URL eshte e detyrueshme" });
  }

  const short_code = shortid.generate();
  const expiration_time = expiration_select
    ? new Date(Date.now() + parseInt(expiration_select) * 60000)
    : null;

  const sql =
    "INSERT INTO shortened_urls (original_url, short_code, expiration_time) VALUES (?, ?, ?)";
  db.query(sql, [long_url, short_code, expiration_time], (err) => {
    if (err) {
      return res.status(500).json({ error: "Deshtoi shkurtesimi i URL" });
    }
    res.json({ short_url: `http://localhost:5000/${short_code}` });
  });
});

// Endpoint per te marre te gjitha URL-te e shkurtesuara
app.get("/get-shortened-urls", (req, res) => {
  const sql = "SELECT original_url, short_code, click_count FROM shortened_urls";
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).send("Gabim gjate marrjes se URL-ve");
    }
    res.json(results);
  });
});

// Endpoint per te fshire nje URL te shkurtesuar
app.delete("/delete-short-url/:short_code", (req, res) => {
  const { short_code } = req.params;

  const sql = "DELETE FROM shortened_urls WHERE short_code = ?";
  db.query(sql, [short_code], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "URL nuk u gjet" });
    }
    res.json({ success: true });
  });
});

// Endpoint per te ridrejtuar ne URL origjinale
app.get("/:short_code", (req, res) => {
  const { short_code } = req.params;

  const sql =
    "SELECT original_url, expiration_time FROM shortened_urls WHERE short_code = ?";
  db.query(sql, [short_code], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.status(404).send("URL e shkurtesuar nuk u gjet");
    }

    const { original_url, expiration_time } = results[0];
    if (expiration_time && new Date(expiration_time) < new Date()) {
      return res.status(410).send("Kjo URL ka skaduar");
    }

    const incrementSql =
      "UPDATE shortened_urls SET click_count = click_count + 1 WHERE short_code = ?";
    db.query(incrementSql, [short_code], (updateErr) => {
      if (updateErr) throw updateErr;
      res.redirect(original_url);
    });
  });
});

// Nise serverin
app.listen(PORT, () => {
  console.log(`Serveri po punon ne http://localhost:${PORT}`);
});
