# Auto Delić Gume — Deployment na Render.com

## Šta ćeš dobiti
- Web aplikacija dostupna na linku (npr. https://autodelic-gume.onrender.com)
- Svi radnici pristupaju sa svog telefona
- Podaci se čuvaju u bazi, ne gube se

---

## Korak 1 — GitHub nalog
1. Idi na https://github.com
2. Klikni "Sign up" i napravi nalog (besplatno)

---

## Korak 2 — Postavi kod na GitHub
1. Na GitHubu klikni zeleno dugme **"New"** (novi repozitorij)
2. Naziv: `autodelic-gume`
3. Klikni **"Create repository"**
4. Na sljedećoj stranici klikni **"uploading an existing file"**
5. **Prevuci sve fajlove** iz ove ZIP arhive na stranicu
6. Klikni **"Commit changes"**

---

## Korak 3 — Render.com
1. Idi na https://render.com
2. Klikni **"Get Started"** → prijavi se sa GitHub nalogom
3. Klikni **"New +"** → **"Web Service"**
4. Poveži GitHub repozitorij `autodelic-gume`
5. Popuni formu:
   - **Name**: autodelic-gume
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
6. Klikni **"Create Web Service"**

Render će automatski pokrenuti aplikaciju za 2-3 minute.

---

## Korak 4 — Pristup sa telefona
- Render ti da link: `https://autodelic-gume.onrender.com`
- Proslijedi link svim radnicima
- Otvore u Chrome/Safari i rade odmah

**Za "app" iskustvo:** Chrome → tri tačke → "Dodaj na početni ekran"

---

## Napomena o besplatnom planu
Na besplatnom Render planu server "zaspi" nakon 15 minuta neaktivnosti.
Prvo otvaranje može biti sporije (~30 sekundi). Plaćeni plan (7$/mj) nema ovaj problem.

---

## Lokalna mreža (alternativa bez interneta)
Ako hoćeš da radi samo na WiFi mreži u firmi bez interneta:
1. Instaliraj Node.js na jedan računar: https://nodejs.org
2. Otvori Command Prompt u folderu sa fajlovima
3. Pokreni: `npm install` pa `node server.js`
4. Svi telefoni na istom WiFi otvaraju: `http://[IP_RAČUNARA]:3000`
