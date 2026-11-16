# EX-YU Radio — mobilna web aplikacija (PWA)

Autor: **Aleksandar Aleksovski**.

Ovaj projekat je zasebna PWA verzija postojeće EX-YU Radio aplikacije. Ne menja već instalirane Windows, Android ili iPhone programe.

## Šta dobijaš

- Internet radio-stanice iz Makedonije, Srbije, Bosne i Hercegovine, Hrvatske, Crne Gore, Slovenije i Nemačke (aktuelni katalog Radio Browser).
- Prikaz svih EX-YU zemalja zajedno, svih sedam zemalja zajedno ili jedne izabrane zemlje.
- Pretragu, omiljene, nedavno slušane i ručno dodate stanice.
- Sedam boja/tema, kontrolu zvuka, čuvanje i vraćanje podešavanja u JSON datoteci.
- Mobilni dizajn, iPhone/Android ikonicu i QR kod za otvaranje aplikacije.
- Detekciju nove verzije, obaveštenje „Ažuriraj sada“ i ručnu proveru preko kružne strelice. Ažuriranje ne zahteva ponovnu instalaciju.
- Izgled radi na Windows, Android i iPhone browseru; *internet je potreban za slušanje*.

## GitHub Pages — besplatno objavljivanje

1. Na GitHubu otvori novi **public** repozitorijum, npr. `EX-YU-Radio-Web`.
2. Kopiraj **sadržaj foldera `dist`** u koren tog repozitorijuma (`index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, `version.json` i `assets/`).
3. U repozitorijumu idi na **Settings → Pages**, pod **Build and deployment** izaberi **Deploy from a branch**, granu `main` i folder `/ (root)`, zatim **Save**.
4. GitHub će prikazati adresu oblika `https://TVOJE-IME.github.io/EX-YU-Radio-Web/`.
5. Otvori tu adresu na računaru i klikni **Instaliraj / QR kod**. QR se automatski pravi za trenutno otvorenu adresu.
6. Skeniraj ga iPhone kamerom, otvori baš u Safariju (ne u ChatGPT pregledu) i izaberi **meni stranice → Share → Add to Home Screen**. Na Androidu u Chromeu izaberi **Install app**.

## Ažuriranja instalirane aplikacije

- Kada se na istoj adresi objavi nova verzija, instalirana PWA može da je preuzme pri sledećem otvaranju.
- Aplikacija dodatno proverava `version.json` i, ako pronađe noviju verziju, prikazuje **Ažuriraj sada**. Kružna strelica u vrhu proverava ručno.
- Za naredno izdanje povećaj `APP_VERSION` u `app.js`, `version` u `version.json`, broj verzije u putanjama `index.html` i naziv keša/putanja u `sw.js`.
- Omiljene stanice i teme ostaju sačuvane u lokalnom skladištu kada se aplikacija ažurira na istom sajtu. Prelazak na drugu domenu (npr. sa trenutnog sajta na GitHub Pages) zahteva izvoz i uvoz podešavanja.

Ako stranica ne radi odmah nakon uključivanja Pages, sačekaj GitHub da je prvi put objavi pa osveži stranicu.

## Šta nije moguće preko PWA

- Ovo nije iPhone `.ipa` ni Android `.apk` fajl.
- Ne pojavljuje se kao posebna aplikacija u Apple CarPlay/Android Auto meniju.
- Radio stream može biti nedostupan, ili browser može odbiti starije `http://` streamove na sigurnoj `https://` adresi.
- Podaci se čuvaju lokalno u tom browseru/PWA instalaciji. Za prenos koristi **Podešavanja → Sačuvaj**, zatim **Vrati** na drugom uređaju.

## Lokalna provera

U folderu `dist` startuj jednostavan statički server (nije potrebno za GitHub Pages). Manifest i service worker funkcionišu na HTTPS ili localhost.

Lista stanica koristi [Radio Browser API](https://docs.radio-browser.info/) sa serverima `de1`, `nl1` i `at1`. Nema logovanja, plaćanja niti API ključa.

Radio Browser izdvaja stanice koje su pale na njegovim automatizovanim proverama (`hidebroken=true`).
To **nije garancija** da će svaki stream trenutno raditi na svakom telefonu: radio može prestati da emituje, imati nekompatibilan format ili koristiti HTTP stream blokiran na HTTPS stranici.
Aplikacija označava stanicu koja nije uspela da se pokrene; pokušaj ponovo ili izaberi drugu.
