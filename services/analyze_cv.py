from flask import Flask, request, jsonify
from flask_cors import CORS  # Importer CORS
import pdfplumber
import spacy
import os

app = Flask(__name__)
CORS(app)  # Activer CORS pour toutes les routes

nlp = spacy.load("fr_core_news_sm")  # Modèle NLP pour le français

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

COMPETENCES_CONNUES = [
    "Python", "Java", "SQL", "JavaScript", "React", "Machine Learning", 
    "Docker", "Node.js", "PHP", "Microsoft Word", "Excel", "Powerpoint", 
    "Access", "Aquarelle", "SAGE", "Français", "Anglais", "Allemand"
]

# Fonction pour extraire le texte du CV
def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                extracted_text = page.extract_text()
                if extracted_text:
                    text += extracted_text + "\n"
        print(f"Texte extrait du PDF: {text[:500]}")  # Afficher les 500 premiers caractères du texte extrait
    except Exception as e:
        print(f"Erreur lors de l'extraction du texte : {e}")
        return None
    return text.strip()

# Fonction pour extraire les compétences du texte
def extract_skills(text):
    print(f"Texte reçu pour extraction des compétences: {text[:500]}")  # Afficher les 500 premiers caractères du texte
    found_skills = [skill for skill in COMPETENCES_CONNUES if skill.lower() in text.lower()]
    print(f"Compétences trouvées: {found_skills}")
    return list(set(found_skills))

@app.route("/api/extract-skills", methods=["POST"])
def extract_skills_api():
    print("Début du traitement de la requête...")  # Afficher que la requête a été reçue
    if "cv" not in request.files:
        print("Aucun fichier reçu.")
        return jsonify({"error": "Aucun fichier reçu"}), 400

    file = request.files["cv"]
    print(f"Fichier reçu : {file.filename}")  # Afficher le nom du fichier reçu

    # Vérification de l'extension du fichier
    if not file.filename.lower().endswith(".pdf"):
        print("Le fichier n'est pas un PDF.")
        return jsonify({"error": "Le fichier doit être un PDF."}), 400

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    print(f"Fichier enregistré temporairement à : {file_path}")  # Afficher le chemin du fichier enregistré

    try:
        file.save(file_path)  # Sauvegarder le fichier sur le serveur
        print("Fichier sauvegardé.")

        # Extraire le texte du PDF et identifier les compétences
        text = extract_text_from_pdf(file_path)
        if text is None:
            print("Erreur d'extraction du texte.")
            return jsonify({"error": "Impossible d'extraire le texte du PDF."}), 500

        skills = extract_skills(text)

        if not skills:
            print("Aucune compétence trouvée.")
            return jsonify({"message": "Aucune compétence trouvée."}), 200
        
        print(f"Compétences extraites: {skills}")
        return jsonify({"skills": skills})

    except Exception as e:
        print(f"Erreur lors du traitement du fichier: {e}")
        return jsonify({"error": "Erreur lors du traitement du fichier"}), 500
    finally:
        # Supprimer le fichier après le traitement
        if os.path.exists(file_path):
            os.remove(file_path)
            print("Fichier temporaire supprimé.")

if __name__ == "__main__":
    app.run(port=5001, debug=True)
