const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware pour parser les données du formulaire
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir les fichiers statiques à partir du dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

// Fonction pour lire les données JSON
function readData(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Erreur de lecture :", err);
        return [];
    }
}

// Fonction pour écrire dans un fichier JSON
function writeData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Erreur d'écriture :", err);
    }
}

// Fonction pour lire les demandes de retrait
function readWithdrawals(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Erreur de lecture des retraits :", err);
        return [];
    }
}

// Fonction pour écrire les demandes de retrait
function writeWithdrawals(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Erreur d'écriture des retraits :", err);
    }
}

// Script de conversion pour transformer `formData.txt` en `formData.json`
const txtFilePath = path.join(__dirname, 'formData.txt');
const jsonFilePath = path.join(__dirname, 'formData.json');

if (fs.existsSync(txtFilePath)) {
    fs.readFile(txtFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Erreur de lecture :", err);
            return;
        }

        const users = data.split('\n\n').filter(Boolean).map(block => {
            const lines = block.split('\n').filter(Boolean);
            const user = {};
            lines.forEach(line => {
                const [key, value] = line.split(':').map(part => part.trim());
                if (key === "Numéro de téléphone") user.phone = value;
                if (key === "Email") user.email = value;
                if (key === "Code de parrainage") user.referralCode = value;
                if (key === "OTP") user.otp = value;
                if (key === "Code unique") user.uniqueCode = value;
                if (key === "Date") user.date = value;
                if (key === "Solde") user.balance = parseInt(value, 10) || 0;
            });
            return user;
        });

        writeData(jsonFilePath, users);
        console.log("Conversion terminée. Données sauvegardées dans formData.json.");
        fs.unlinkSync(txtFilePath); // Supprime le fichier texte original
        console.log("Ancien fichier formData.txt supprimé.");
    });
}

// Route pour l'affichage de la page d'accueil
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'index.html');
    if (!fs.existsSync(filePath)) {
        console.error("Le fichier index.html est introuvable.");
        return res.status(404).send("Page d'accueil introuvable.");
    }
    res.sendFile(filePath);
});

// Route pour afficher la page de connexion
app.get('/login', (req, res) => {
    const loginPath = path.join(__dirname, 'public', 'login.html');
    if (!fs.existsSync(loginPath)) {
        console.error("Le fichier login.html est introuvable.");
        return res.status(404).send("Page de connexion introuvable.");
    }
    res.sendFile(loginPath);
});

// Route pour gérer la connexion d'un utilisateur
app.post('/login', (req, res) => {
    const { phone, uniqueCode } = req.body;

    if (!phone || !uniqueCode) {
        return res.status(400).send("Veuillez remplir tous les champs obligatoires.");
    }

    const users = readData(jsonFilePath);

    const userFound = users.find(user => user.phone === phone && user.uniqueCode === uniqueCode);

    if (userFound) {
        console.log("Connexion réussie pour :", phone);
        res.redirect(`/compte.html?phone=${phone}`);  // Redirection vers la page du compte avec le téléphone en paramètre
    } else {
        console.log("Informations incorrectes :", phone, uniqueCode);
        res.status(401).send("Numéro ou code unique incorrect.");
    }
});

// Route pour traiter l'enregistrement des données du formulaire
app.post('/register', (req, res) => {
    const { email, phone, referralCode, otp } = req.body;

    if (!email || !phone || !otp) {
        return res.status(400).send("Veuillez remplir tous les champs obligatoires.");
    }

    const users = readData(jsonFilePath);
    const referrer = users.find(user => user.uniqueCode === referralCode);

    if (referralCode && !referrer) {
        return res.status(400).send("Le code de parrainage est invalide.");
    }

    const userCode = Math.random().toString(36).toUpperCase().substr(2, 5);
    const currentDate = new Date().toISOString();

    const newUser = {
        phone,
        email,
        referralCode: referralCode || 'Aucun',
        otp,
        uniqueCode: userCode,
        date: currentDate,
        balance: 0
    };

    users.push(newUser);
    writeData(jsonFilePath, users);

    console.log("Nouvel utilisateur enregistré :", phone);

    if (referrer) {
        referrer.balance += 500;
        writeData(jsonFilePath, users);
        console.log("Solde du parrain augmenté de 500 pour :", referrer.phone);
    }

    res.redirect('/validation_d_inscription.html');
});

// Route pour valider un code unique
app.post('/validate-code', (req, res) => {
    const { code } = req.body;

    const users = readData(jsonFilePath);

    const userFound = users.some(user => user.uniqueCode === code);

    if (userFound) {
        console.log("Code validé :", code);
        res.redirect('/compte.html');
    } else {
        res.status(401).send("Code incorrect. Veuillez réessayer.");
    }
});

// Route pour récupérer les informations de l'utilisateur
app.get('/get-user-info', (req, res) => {
    const { phone } = req.query;  // Récupère le numéro de téléphone passé en paramètre

    if (!phone) {
        return res.status(400).send("Numéro de téléphone manquant.");
    }

    const users = readData(jsonFilePath);

    if (users.length === 0) {
        return res.status(404).send("Aucun utilisateur trouvé.");
    }

    // Recherche l'utilisateur par son numéro de téléphone
    const user = users.find(u => u.phone === phone);

    if (!user) {
        return res.status(404).send("Utilisateur non trouvé.");
    }

    // Renvoyer les informations de l'utilisateur
    const userData = {
        email: user.email,
        phone: user.phone,
        referrals: user.referralCode !== 'Aucun' ? 1 : 0,
        balance: user.balance
    };

    res.json(userData);
});

// Route pour gérer les demandes de retrait
app.post('/withdraw', (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).send("Numéro de téléphone ou montant manquant.");
    }

    const users = readData(jsonFilePath);
    const withdrawals = readWithdrawals(path.join(__dirname, 'withdrawals.json'));

    const userIndex = users.findIndex(user => user.phone === phone);

    if (userIndex !== -1) {
        const user = users[userIndex];

        if (amount <= user.balance) {
            const newWithdrawal = {
                phone: user.phone,
                amount: amount,
                date: new Date().toISOString(),
                status: 'En attente'
            };
            withdrawals.push(newWithdrawal);
            writeWithdrawals(path.join(__dirname, 'withdrawals.json'), withdrawals);

            user.balance -= amount;
            writeData(jsonFilePath, users);

            res.json({ message: "Demande de retrait enregistrée", balance: user.balance });
        } else {
            return res.status(400).send("Solde insuffisant.");
        }
    } else {
        return res.status(404).send("Utilisateur non trouvé.");
    }
});

// Lancer le serveur
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
