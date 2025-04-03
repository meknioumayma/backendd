const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/generate-qcm", upload.single("cv"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Veuillez télécharger un CV." });
  }

  const cvPath = path.join(__dirname, "..", req.file.path);

  try {
    // Ajout du log pour vérifier le fichier téléchargé
    console.log('Fichier reçu:', req.file);

    // Envoi du CV à l'API Python
    const response = await axios.post(
      "http://localhost:5001/api/extract-skills", 
      { cv: fs.createReadStream(cvPath) }, 
      { headers: { "Content-Type": "multipart/form-data" } }
    );

    const competences = response.data.skills;

    console.log("Compétences extraites :", competences);

    if (!competences || competences.length === 0) {
      return res.json({ message: "Aucune compétence trouvée.", qcm: [] });
    }

    // Requête SQL pour récupérer des questions adaptées aux compétences
    const sql = "SELECT * FROM questions WHERE competence IN (?)";
    
    db.query(sql, [competences], (err, results) => {
      if (err) {
        console.error("Erreur SQL :", err);
        return res.status(500).json({ error: "Erreur de récupération des questions." });
      }

      console.log("Résultats SQL :", results);
      res.json({ message: "QCM généré avec succès", qcm: results });
    });
  } catch (error) {
    console.error("Erreur lors de l'analyse du CV :", error);
    res.status(500).json({ error: "Erreur d'analyse du CV." });
  }
});

module.exports = router;
