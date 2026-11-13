/* Convertitore — le unità. Ogni fattore è esatto, per definizione, dalle fonti scritte in docs/fonti.md (BIPM, NIST SP 811 e
   Handbook 44, Weights and Measures Act 1985, IEC 80000-13): niente valori misurati, niente arrotondamenti nei fattori.
   CV.unita.leggi(testo, scelte) capisce «12 km», «70 kg in lb», «100 °F», «5'11"», «1.500 m»; quando una parola o un numero
   si leggono in due modi non tira a indovinare: risponde { stato: "dubbio" } con le letture possibili, e scelte[chiave] le risolve.
   Plain script, ES2017. Dopo motore-numeri.js. */
(function (G) {
  "use strict";
  var CV = G.CV, Q = CV.Q;

  /* id | famiglia | simbolo | nome | plurale | fattore verso la base (m, kg, K, m², m³, m/s, byte) | gruppo | definizione */
  var TABELLA = [
    "km|lunghezza|km|chilometro|chilometri|1000|m|1 km = 1000 m",
    "m|lunghezza|m|metro|metri|1|m|il metro è l'unità SI",
    "cm|lunghezza|cm|centimetro|centimetri|1/100|m|1 cm = 0,01 m",
    "mm|lunghezza|mm|millimetro|millimetri|1/1000|m|1 mm = 0,001 m",
    "um|lunghezza|µm|micrometro|micrometri|1e-6|m|1 µm = 10⁻⁶ m",
    "nm|lunghezza|nm|nanometro|nanometri|1e-9|m|1 nm = 10⁻⁹ m",
    "mi|lunghezza|mi|miglio|miglia|1609.344|i|1 mi = 1760 yd = 1609,344 m (accordo del 1959)",
    "yd|lunghezza|yd|iarda|iarde|0.9144|i|1 yd = 0,9144 m (accordo del 1959)",
    "ft|lunghezza|ft|piede|piedi|0.3048|i|1 ft = 0,3048 m (accordo del 1959)",
    "in|lunghezza|in|pollice|pollici|0.0254|i|1 in = 2,54 cm (accordo del 1959)",
    "nmi|lunghezza|nmi|miglio nautico|miglia nautiche|1852|n|1 nmi = 1852 m",
    "t|massa|t|tonnellata|tonnellate|1000|m|1 t = 1000 kg",
    "q|massa|q|quintale|quintali|100|m|1 q = 100 kg",
    "kg|massa|kg|chilogrammo|chilogrammi|1|m|il chilogrammo è l'unità SI",
    "g|massa|g|grammo|grammi|1/1000|m|1 g = 0,001 kg",
    "mg|massa|mg|milligrammo|milligrammi|1e-6|m|1 mg = 0,001 g",
    "lb|massa|lb|libbra|libbre|0.45359237|i|1 lb = 0,45359237 kg (accordo del 1959)",
    "oz|massa|oz|oncia|once|0.028349523125|i|1 oz = 1/16 lb = 28,349523125 g",
    "st|massa|st|stone|stone|6.35029318|i|1 st = 14 lb",
    "tonus|massa|ton USA|tonnellata corta|tonnellate corte|907.18474|x|1 ton USA = 2000 lb",
    "tonuk|massa|ton UK|tonnellata lunga|tonnellate lunghe|1016.0469088|x|1 ton UK = 2240 lb",
    "C|temperatura|°C|grado Celsius|gradi Celsius|1|m|°C = K − 273,15",
    "F|temperatura|°F|grado Fahrenheit|gradi Fahrenheit|5/9|i|°F = °C × 9/5 + 32",
    "K|temperatura|K|kelvin|kelvin|1|m|il kelvin è l'unità SI; 0 K è lo zero assoluto",
    "km2|area|km²|chilometro quadrato|chilometri quadrati|1e6|m|1 km² = 100 ha",
    "ha|area|ha|ettaro|ettari|1e4|m|1 ha = 10.000 m²",
    "a|area|a|ara|are|100|x|1 a = 100 m²",
    "m2|area|m²|metro quadrato|metri quadrati|1|m|1 m²",
    "cm2|area|cm²|centimetro quadrato|centimetri quadrati|1e-4|m|1 cm² = 0,0001 m²",
    "mi2|area|mi²|miglio quadrato|miglia quadrate|2589988.110336|i|1 mi² = 640 acri",
    "ac|area|ac|acro|acri|4046.8564224|i|1 acro = 4840 yd²",
    "yd2|area|yd²|iarda quadrata|iarde quadrate|0.83612736|i|1 yd² = 0,83612736 m²",
    "ft2|area|ft²|piede quadrato|piedi quadrati|0.09290304|i|1 ft² = 0,09290304 m²",
    "in2|area|in²|pollice quadrato|pollici quadrati|0.00064516|i|1 in² = 6,4516 cm²",
    "m3|volume|m³|metro cubo|metri cubi|1|m|1 m³ = 1000 L",
    "L|volume|L|litro|litri|1/1000|m|1 L = 1 dm³ (dal 1964)",
    "dL|volume|dL|decilitro|decilitri|1e-4|m|1 dL = 0,1 L",
    "cL|volume|cL|centilitro|centilitri|1e-5|m|1 cL = 0,01 L",
    "mL|volume|mL|millilitro|millilitri|1e-6|m|1 mL = 1 cm³",
    "galus|volume|gal USA|gallone USA|galloni USA|0.003785411784|i|1 gal USA = 231 in³ = 3,785411784 L",
    "galuk|volume|gal UK|gallone imperiale|galloni imperiali|0.00454609|u|1 gal UK = 4,54609 L (Weights and Measures Act 1985)",
    "ptus|volume|pt USA|pinta USA|pinte USA|0.000473176473|i|1 pt USA = 1/8 gal USA",
    "ptuk|volume|pt UK|pinta imperiale|pinte imperiali|0.00056826125|u|1 pt UK = 1/8 gal UK",
    "cupus|volume|cup USA|tazza USA|tazze USA|0.0002365882365|i|1 tazza USA = 8 fl oz USA",
    "cupm|volume|tazza|tazza metrica|tazze metriche|0.00025|x|1 tazza metrica = 250 mL",
    "flozus|volume|fl oz USA|oncia liquida USA|once liquide USA|0.0000295735295625|i|1 fl oz USA = 1/128 gal USA",
    "flozuk|volume|fl oz UK|oncia liquida imperiale|once liquide imperiali|0.0000284130625|u|1 fl oz UK = 1/160 gal UK",
    "ft3|volume|ft³|piede cubo|piedi cubi|0.028316846592|i|1 ft³ = 1728 in³",
    "in3|volume|in³|pollice cubo|pollici cubi|0.000016387064|i|1 in³ = 16,387064 cm³",
    "kmh|velocita|km/h|chilometro orario|chilometri orari|5/18|m|1 km/h = 1000 m in 3600 s",
    "ms|velocita|m/s|metro al secondo|metri al secondo|1|m|il metro al secondo è l'unità SI",
    "mph|velocita|mph|miglio orario|miglia orarie|0.44704|i|1 mph = 1609,344 m in 3600 s",
    "kn|velocita|kn|nodo|nodi|463/900|n|1 nodo = 1852 m in 3600 s",
    "fts|velocita|ft/s|piede al secondo|piedi al secondo|0.3048|i|1 ft/s = 0,3048 m/s",
    "bit|dati|bit|bit|bit|1/8|d|1 byte = 8 bit",
    "B|dati|B|byte|byte|1|d|1 byte = 8 bit",
    "kB|dati|kB|kilobyte|kilobyte|1e3|d|1 kB = 1000 byte (SI)",
    "MB|dati|MB|megabyte|megabyte|1e6|d|1 MB = 1000 kB = 10⁶ byte (SI)",
    "GB|dati|GB|gigabyte|gigabyte|1e9|d|1 GB = 1000 MB = 10⁹ byte (SI)",
    "TB|dati|TB|terabyte|terabyte|1e12|d|1 TB = 1000 GB = 10¹² byte (SI)",
    "PB|dati|PB|petabyte|petabyte|1e15|d|1 PB = 1000 TB = 10¹⁵ byte (SI)",
    "KiB|dati|KiB|kibibyte|kibibyte|1024|b|1 KiB = 1024 byte (IEC)",
    "MiB|dati|MiB|mebibyte|mebibyte|1048576|b|1 MiB = 1024 KiB = 2²⁰ byte (IEC)",
    "GiB|dati|GiB|gibibyte|gibibyte|1073741824|b|1 GiB = 1024 MiB = 2³⁰ byte (IEC)",
    "TiB|dati|TiB|tebibyte|tebibyte|1099511627776|b|1 TiB = 1024 GiB = 2⁴⁰ byte (IEC)",
    "PiB|dati|PiB|pebibyte|pebibyte|1125899906842624|b|1 PiB = 1024 TiB = 2⁵⁰ byte (IEC)",
    "kbit|dati|kbit|kilobit|kilobit|125|d|1 kbit = 1000 bit",
    "Mbit|dati|Mbit|megabit|megabit|125000|d|1 Mbit = 10⁶ bit",
    "Gbit|dati|Gbit|gigabit|gigabit|125000000|d|1 Gbit = 10⁹ bit"
  ];
  var U = {}, ORDINE = [];
  TABELLA.forEach(function (r) {
    var c = r.split("|");
    U[c[0]] = { id: c[0], famiglia: c[1], simbolo: c[2], nome: c[3], plurale: c[4], f: Q.dec(c[5]), gruppo: c[6], def: c[7] };
    ORDINE.push(c[0]);
  });
  /* le temperature: K = x · f + o */
  U.C.o = Q.dec("273.15"); U.F.o = Q.dec("45967/180"); U.K.o = Q.dec("0");

  var FAMIGLIE = {
    lunghezza: { nome: "Lunghezza", righe: [["Metrico", ["km", "m", "cm", "mm", "um", "nm"]], ["Imperiale e USA", ["mi", "yd", "ft", "in"]], ["Mare e cielo", ["nmi"]]] },
    massa: { nome: "Peso", righe: [["Metrico", ["t", "q", "kg", "g", "mg"]], ["Imperiale e USA", ["lb", "oz", "st"]]] },
    temperatura: { nome: "Temperatura", righe: [["", ["C", "F", "K"]]] },
    area: { nome: "Area", righe: [["Metrico", ["km2", "ha", "m2", "cm2"]], ["Imperiale e USA", ["mi2", "ac", "yd2", "ft2", "in2"]]] },
    volume: { nome: "Volume", righe: [["Metrico", ["m3", "L", "dL", "cL", "mL"]], ["USA", ["galus", "ptus", "cupus", "flozus"]], ["Regno Unito", ["galuk", "ptuk", "flozuk"]], ["Cubi", ["ft3", "in3"]]] },
    velocita: { nome: "Velocità", righe: [["", ["kmh", "ms", "mph", "kn", "fts"]]] },
    dati: { nome: "Dati", righe: [["A 1000 (SI): dischi, reti, macOS", ["B", "kB", "MB", "GB", "TB", "PB"]], ["A 1024 (IEC): memoria, Windows", ["KiB", "MiB", "GiB", "TiB", "PiB"]], ["In bit: velocità delle reti", ["bit", "kbit", "Mbit", "Gbit"]]] }
  };
  var CONTRO = { km: "mi", m: "ft", cm: "in", mm: "in", um: "mm", nm: "um", mi: "km", yd: "m", ft: "m", "in": "cm", nmi: "km",
    t: "lb", q: "kg", kg: "lb", g: "oz", mg: "g", lb: "kg", oz: "g", st: "kg", tonus: "t", tonuk: "t",
    C: "F", F: "C", K: "C", km2: "mi2", ha: "ac", a: "m2", m2: "ft2", cm2: "in2", mi2: "km2", ac: "ha", yd2: "m2", ft2: "m2", in2: "cm2",
    m3: "L", L: "galus", dL: "mL", cL: "mL", mL: "flozus", galus: "L", galuk: "L", ptus: "mL", ptuk: "mL", cupus: "mL", cupm: "mL", flozus: "mL", flozuk: "mL", ft3: "L", in3: "mL",
    kmh: "mph", ms: "kmh", mph: "kmh", kn: "kmh", fts: "ms",
    bit: "B", B: "bit", kB: "KiB", MB: "MiB", GB: "GiB", TB: "TiB", PB: "PiB", KiB: "kB", MiB: "MB", GiB: "GB", TiB: "TB", PiB: "PB", kbit: "kB", Mbit: "MB", Gbit: "GB" };

  /* le parole: prima com'è scritta (le maiuscole contano: MB non è Mb), poi in minuscolo */
  var ESATTE = { B: "B", kB: "kB", MB: "MB", GB: "GB", TB: "TB", PB: "PB", Mb: "Mbit", Gb: "Gbit", Tb: null, K: "K", NM: "nmi", nm: "nm", Mbps: "Mbit", L: "L", l: "L", mL: "mL", dL: "dL", cL: "cL" };
  var PAROLE = {};
  function parole(id, lista) { lista.split(",").forEach(function (p) { PAROLE[p.trim()] = id; }); }
  parole("km", "km,chilometro,chilometri,kilometro,kilometri,kilometre,kilometres,kilometer,kilometers,chilo metri");
  parole("m", "m,metro,metri,metre,metres,meter,meters,mt");
  parole("cm", "cm,centimetro,centimetri,centimetre,centimetres,centimeter,centimeters");
  parole("mm", "mm,millimetro,millimetri,millimetre,millimetres,millimeter,millimeters");
  parole("um", "µm,um,micrometro,micrometri,micron,micrometre,micrometer,micrometers");
  parole("nm", "nanometro,nanometri,nanometre,nanometer,nanometers");
  parole("mi", "mi,miglio,miglia,mile,miles,miglio terrestre,miglia terrestri");
  parole("nmi", "nmi,miglio nautico,miglia nautiche,miglio marino,miglia marine,nautical mile,nautical miles");
  parole("yd", "yd,yds,iarda,iarde,yard,yards");
  parole("ft", "ft,piede,piedi,foot,feet");
  parole("in", "in,pollice,pollici,inch,inches,pol");
  parole("t", "t,tonnellata,tonnellate,tonne,tonnes,metric ton");
  parole("q", "q,quintale,quintali");
  parole("kg", "kg,kgs,chilo,chili,chilogrammo,chilogrammi,kilogrammo,kilogrammi,kilo,kilos,kilogram,kilograms,kilogramme");
  parole("g", "g,gr,grammo,grammi,gram,grams,gramme");
  parole("mg", "mg,milligrammo,milligrammi,milligram,milligrams");
  parole("lb", "lb,lbs,libbra,libbre,pound,pounds");
  parole("st", "st,stone,stones");
  parole("tonus", "ton usa,short ton,short tons,tonnellata corta,tonnellate corte");
  parole("tonuk", "ton uk,long ton,long tons,tonnellata lunga,tonnellate lunghe");
  parole("C", "°c,c,celsius,gradi celsius,grado celsius,centigradi,gradi centigradi,degc");
  parole("F", "°f,f,fahrenheit,gradi fahrenheit,grado fahrenheit,degf");
  parole("K", "kelvin");
  parole("km2", "km2,kmq,chilometro quadrato,chilometri quadrati,chilometri quadri,sq km,square kilometre,square kilometers");
  parole("ha", "ha,ettaro,ettari,hectare,hectares");
  parole("a", "ara,are");
  parole("m2", "m2,mq,metro quadrato,metri quadrati,metri quadri,metro quadro,sq m,square metre,square metres,square meters");
  parole("cm2", "cm2,cmq,centimetro quadrato,centimetri quadrati,centimetri quadri");
  parole("mi2", "mi2,sq mi,miglio quadrato,miglia quadrate,square mile,square miles");
  parole("ac", "ac,acro,acri,acre,acres");
  parole("yd2", "yd2,sq yd,iarda quadrata,iarde quadrate,square yard,square yards");
  parole("ft2", "ft2,sq ft,sqft,piede quadrato,piedi quadrati,piedi quadri,square foot,square feet");
  parole("in2", "in2,sq in,pollice quadrato,pollici quadrati,square inch,square inches");
  parole("m3", "m3,mc,metro cubo,metri cubi,cubic metre,cubic meters");
  parole("L", "lt,litro,litri,litre,litres,liter,liters");
  parole("dL", "dl,decilitro,decilitri");
  parole("cL", "cl,centilitro,centilitri");
  parole("mL", "ml,millilitro,millilitri,millilitre,millilitres,milliliter,milliliters,cc,cm3,cmc");
  parole("galus", "gal usa,gal us,us gal,gallone usa,galloni usa,gallone americano,galloni americani,us gallon,us gallons");
  parole("galuk", "gal uk,uk gal,gallone imperiale,galloni imperiali,gallone inglese,galloni inglesi,imperial gallon,imperial gallons");
  parole("ptus", "pt usa,pt us,pinta usa,pinte usa,pinta americana,pinte americane,us pint,us pints");
  parole("ptuk", "pt uk,pinta imperiale,pinte imperiali,pinta inglese,pinte inglesi,imperial pint,imperial pints");
  parole("cupus", "cup usa,cup us,tazza usa,tazze usa,us cup,us cups");
  parole("cupm", "tazza metrica,tazze metriche,metric cup,metric cups");
  parole("flozus", "fl oz usa,fl oz us,floz usa,oncia liquida usa,once liquide usa,us fl oz");
  parole("flozuk", "fl oz uk,floz uk,oncia liquida imperiale,once liquide imperiali,uk fl oz,imperial fl oz");
  parole("ft3", "ft3,cu ft,piede cubo,piedi cubi,cubic foot,cubic feet");
  parole("in3", "in3,cu in,pollice cubo,pollici cubi,cubic inch,cubic inches");
  parole("kmh", "km/h,kmh,km/ora,km orari,km all'ora,chilometri orari,chilometri all'ora,chilometro orario,kph");
  parole("ms", "m/s,metri al secondo,metro al secondo,mps");
  parole("mph", "mph,mi/h,miglia orarie,miglia all'ora,miles per hour");
  parole("kn", "kn,kt,kts,nodo,nodi,knot,knots");
  parole("fts", "ft/s,fps,piedi al secondo");
  parole("bit", "bit,bits");
  parole("B", "byte,bytes");
  parole("kB", "kilobyte,kilobytes");
  parole("MB", "megabyte,megabytes");
  parole("GB", "gigabyte,gigabytes");
  parole("TB", "terabyte,terabytes");
  parole("PB", "petabyte,petabytes");
  parole("KiB", "kib,kibibyte,kibibytes");
  parole("MiB", "mib,mebibyte,mebibytes");
  parole("GiB", "gib,gibibyte,gibibytes");
  parole("TiB", "tib,tebibyte,tebibytes");
  parole("PiB", "pib,pebibyte,pebibytes");
  parole("kbit", "kbit,kbps,kilobit,kilobits");
  parole("Mbit", "mbit,megabit,megabits");
  parole("Gbit", "gbit,gbps,gigabit,gigabits");
  /* le parole che si leggono in più modi: si chiede (la prima è la più probabile qui, ma non si sceglie da soli) */
  var DUBBI = {
    oz: ["oz", "flozus", "flozuk"], once: ["oz", "flozus", "flozuk"], oncia: ["oz", "flozus", "flozuk"], ounce: ["oz", "flozus", "flozuk"], ounces: ["oz", "flozus", "flozuk"],
    "fl oz": ["flozus", "flozuk"], floz: ["flozus", "flozuk"], "once liquide": ["flozus", "flozuk"], "oncia liquida": ["flozus", "flozuk"],
    gal: ["galus", "galuk"], gallone: ["galus", "galuk"], galloni: ["galus", "galuk"], gallon: ["galus", "galuk"], gallons: ["galus", "galuk"],
    pt: ["ptus", "ptuk"], pinta: ["ptus", "ptuk"], pinte: ["ptus", "ptuk"], pint: ["ptus", "ptuk"], pints: ["ptus", "ptuk"],
    cup: ["cupus", "cupm"], cups: ["cupus", "cupm"], tazza: ["cupus", "cupm"], tazze: ["cupus", "cupm"],
    ton: ["t", "tonus", "tonuk"], tons: ["t", "tonus", "tonuk"],
    gradi: ["C", "F"], grado: ["C", "F"], "°": ["C", "F"], deg: ["C", "F"],
    KB: ["kB", "KiB"], Kb: ["kbit", "kB"], kb: ["kbit", "kB"], mb: ["MB", "Mbit"], gb: ["GB", "Gbit"], tb: ["TB"], b: ["bit", "B"]
  };
  var DOMANDE = { oz: "«oz» è un peso o un volume?", gal: "Gallone americano o imperiale?", pt: "Pinta americana o imperiale?",
    cup: "Quale tazza?", ton: "Quale tonnellata?", gradi: "Gradi Celsius o Fahrenheit?", KB: "«KB» a 1000 o a 1024 byte?", bit: "Bit o byte?" };
  function domanda(chiave, opz) {
    if (opz[0] === "C") return DOMANDE.gradi;
    if (opz[0] === "oz") return DOMANDE.oz;
    if (opz[0] === "flozus") return "Oncia liquida americana o imperiale?";
    if (opz[0] === "galus") return DOMANDE.gal;
    if (opz[0] === "ptus") return DOMANDE.pt;
    if (opz[0] === "cupus") return DOMANDE.cup;
    if (opz[0] === "t") return DOMANDE.ton;
    if (opz[0] === "kB") return DOMANDE.KB;
    return "«" + chiave + "»: " + opz.map(function (i) { return U[i].nome; }).join(" o ") + "?";
  }

  function pulisci(s) {
    return s.trim().replace(/\s+/g, " ").replace(/[º˚]/g, "°").replace(/° +/g, "°").replace(/²/g, "2").replace(/³/g, "3").replace(/\^([23])/g, "$1")
      .replace(/μ/g, "µ").replace(/\.$/, "").replace(/^(?:di |de )/, "");
  }
  /* → { id } | { dubbio: [id...], chiave } | null */
  function trovaUnita(s) {
    var t = pulisci(s); if (!t) return null;
    if (Object.prototype.hasOwnProperty.call(ESATTE, t)) return ESATTE[t] ? { id: ESATTE[t] } : null;
    if (Object.prototype.hasOwnProperty.call(DUBBI, t) && /[A-Z]/.test(t)) return { dubbio: DUBBI[t], chiave: t };
    var l = t.toLowerCase().replace(/\bin usa\b/, "usa");
    if (Object.prototype.hasOwnProperty.call(PAROLE, l)) return { id: PAROLE[l] };
    if (Object.prototype.hasOwnProperty.call(DUBBI, l)) return DUBBI[l].length === 1 ? { id: DUBBI[l][0] } : { dubbio: DUBBI[l], chiave: l };
    var senzaS = l.replace(/s$/, "");
    if (senzaS !== l && PAROLE[senzaS]) return { id: PAROLE[senzaS] };
    return null;
  }
  function eNumero(tok) { return /^[+\-−]?(?:[\d][\d.,]*(?:e[+-]?\d+)?|\d+\/\d+|[.,]\d+)$/i.test(tok); }

  function nomeDi(id, q) { var u = U[id]; return q && Q.cmp(q, Q.dec("1")) === 0 ? u.nome : u.plurale; }
  function inBase(q, u) { return u.o ? Q.add(Q.mul(q, u.f), u.o) : Q.mul(q, u.f); }
  function daBase(b, u) { return u.o ? Q.div(Q.sub(b, u.o), u.f) : Q.div(b, u.f); }

  /* ---------------------------------------------------------------- leggere una frase */
  function leggi(testo, scelte) {
    scelte = scelte || {};
    var s = String(testo || "").replace(/−/g, "-").replace(/\s+/g, " ").trim();
    if (!s) return { stato: "vuoto" };
    var qq = s.match(/^quant[ieoa] (.+?) (?:sono|fanno|fa|è|e) (.+?)\??$/i); if (qq) s = qq[2] + " in " + qq[1];
    s = s.replace(/\?$/, "").trim();
    /* 5'11" e 5′ 11″ → 5 ft 11 in */
    s = s.replace(/(\d)\s*['′]\s*(\d+(?:[.,]\d+)?)\s*(?:["″]|'')?/g, "$1 ft $2 in").replace(/(\d)\s*['′](?=\s|$)/g, "$1 ft").replace(/(\d)\s*["″](?=\s|$)/g, "$1 in");
    s = s.replace(/\s*(?:->|→|=>|=|>)\s*/g, " in ");
    /* 12km → 12 km (non 1e3, né 3/4) */
    s = s.replace(/(\d)(?=[a-zA-Z°µμ%])/g, function (m, d, i, all) { return /^e[+-]?\d/i.test(all.slice(i + 1)) ? d : d + " "; });
    /* le migliaia con lo spazio: 12 345 km */
    s = s.replace(/(\d) (?=\d{3}(?!\d|[.,]\d))/g, "$1");
    var tok = s.split(" ").filter(Boolean);
    /* la destinazione: «in <unità>» alla fine (prova ogni «in»: «12 in in cm») */
    var dest = null, fine = tok.length;
    for (var i = tok.length - 2; i >= 1; i--) {
      if (!/^(?:in|a|to|en|into|per)$/i.test(tok[i])) continue;
      var resto = tok.slice(i + 1).join(" ").replace(/^quant[ieoa] /i, "");
      if (tok.slice(i + 1).some(eNumero)) continue;
      var u = trovaUnita(resto);
      if (u && i >= 2) { dest = u; dest.testo = resto; fine = i; break; }
    }
    var pezzi = [], k = 0, dubbi = [];
    while (k < fine) {
      if (!eNumero(tok[k])) {
        if (k === 0) return { stato: "no" };
        return { stato: "errore", messaggio: "Non conosco «" + tok.slice(k, fine).join(" ") + "»." };
      }
      var nt = tok[k], letto = CV.leggiNumero(nt); k++;
      if (!letto) return { stato: "errore", messaggio: "Non capisco il numero «" + nt + "»." };
      var j = k; while (j < fine && !eNumero(tok[j])) j++;
      var frase = tok.slice(k, j).join(" ");
      if (!frase) { if (pezzi.length === 0) return { stato: "senzaunita", numero: letto }; return { stato: "errore", messaggio: "Dopo «" + nt + "» manca l'unità." }; }
      var un = trovaUnita(frase);
      if (!un) return { stato: "errore", messaggio: "Non conosco «" + frase + "».", parola: frase };
      pezzi.push({ numero: nt, letto: letto, unita: un, frase: frase });
      k = j;
    }
    if (!pezzi.length) return { stato: "no" };
    /* i dubbi, nell'ordine in cui si leggono: prima i numeri, poi le parole, poi la destinazione */
    function risolvi(chiave, opzioni, testoDomanda, tipo) {
      if (Object.prototype.hasOwnProperty.call(scelte, chiave) && scelte[chiave] < opzioni.length) return opzioni[scelte[chiave]];
      dubbi.push({ chiave: chiave, domanda: testoDomanda, opzioni: opzioni, tipo: tipo });
      return opzioni[0];
    }
    pezzi.forEach(function (p) {
      if (p.letto.dubbio) {
        var op = p.letto.dubbio.map(function (d) { return { valore: d.valore, testo: CV.scrivi(d.valore, { sig: 12 }).testo, nota: d.nota }; });
        p.q = risolvi("n:" + p.numero, op, "«" + p.numero + "» vuol dire…", "numero").valore;
      } else p.q = p.letto.valore;
      if (p.unita.dubbio) {
        var ou = p.unita.dubbio.map(function (id) { return { id: id, testo: U[id].nome + (U[id].famiglia === "volume" && p.unita.dubbio[0] === "oz" ? " (volume)" : U[id].famiglia === "massa" && p.unita.dubbio.length > 2 && id === "oz" ? " (peso)" : ""), nota: U[id].def }; });
        p.id = risolvi("u:" + p.unita.chiave, ou, domanda(p.unita.chiave, p.unita.dubbio), "unita").id;
      } else p.id = p.unita.id;
      if (WIN[p.id] && !p.unita.dubbio && scelte["w:" + p.id] === 1) { p.prima = p.id; p.id = WIN[p.id][0]; }
    });
    var aId = null;
    if (dest) {
      if (dest.dubbio) aId = risolvi("a:" + dest.chiave, dest.dubbio.map(function (id) { return { id: id, testo: U[id].nome, nota: U[id].def }; }), domanda(dest.chiave, dest.dubbio), "unita").id;
      else aId = dest.id;
    }
    var fam = U[pezzi[0].id].famiglia;
    for (var x = 1; x < pezzi.length; x++) {
      if (U[pezzi[x].id].famiglia !== fam) return { stato: "errore", messaggio: "«" + pezzi[0].frase + "» e «" + pezzi[x].frase + "» non si sommano: " + FAMIGLIE[fam].nome.toLowerCase() + " e " + FAMIGLIE[U[pezzi[x].id].famiglia].nome.toLowerCase() + "." };
    }
    if (fam === "temperatura" && pezzi.length > 1) return { stato: "errore", messaggio: "Le temperature non si sommano: scrivine una." };
    if (aId && U[aId].famiglia !== fam) return { stato: "errore", messaggio: "«" + pezzi[0].frase + "» è " + articolo(fam) + ", «" + dest.testo + "» è " + articolo(U[aId].famiglia) + ": non si convertono." };
    if (dubbi.length) return { stato: "dubbio", dubbio: dubbi[0], dubbi: dubbi, famiglia: fam };
    var base = Q.dec("0");
    pezzi.forEach(function (p) { base = Q.add(base, inBase(p.q, U[p.id])); });
    var note = [];
    if (fam === "temperatura" && Q.cmp(base, Q.dec("0")) < 0) return { stato: "errore", messaggio: "È sotto lo zero assoluto (−273,15 °C, −459,67 °F): più freddo di così non si può." };
    var daId = pezzi[0].id;
    if (!aId) {
      aId = CONTRO[daId];
      if (pezzi.length > 1 && U[daId].gruppo === "i") aId = fam === "lunghezza" ? "cm" : fam === "massa" ? "kg" : aId;
    }
    /* GB, MB…: per lo standard sono a 1000; Windows li scrive uguali ma conta a 1024. Si dice, e si può passare all'altra lettura */
    pezzi.forEach(function (p) {
      var w = WIN[p.id] || WIN[p.prima]; if (!w || p.unita.dubbio) return;
      var attiva = scelte["w:" + (p.prima || p.id)] === 1;
      if (note.some(function (n) { return n.chiave === "w:" + (p.prima || p.id); })) return;
      note.push({ tipo: "windows", chiave: "w:" + (p.prima || p.id), attiva: attiva,
        testo: attiva ? "Letto come " + U[w[0]].simbolo + ", come fa Windows: 1 " + U[w[0]].simbolo + " = " + w[2] + "."
                      : U[p.prima || p.id].simbolo + " vale " + w[1] + ". Windows lo scrive uguale ma conta a 1024.",
        bottone: attiva ? "Torna a " + U[p.prima || p.id].simbolo : "Leggi come " + U[w[0]].simbolo });
    });
    return { stato: "ok", famiglia: fam, base: base, da: daId, a: aId, pezzi: pezzi.map(function (p) { return { q: p.q, id: p.id }; }), note: note };
  }
  var WIN = { kB: ["KiB", "1000 byte", "1024 byte"], MB: ["MiB", "10⁶ byte", "2²⁰ byte"], GB: ["GiB", "10⁹ byte", "2³⁰ byte"], TB: ["TiB", "10¹² byte", "2⁴⁰ byte"], PB: ["PiB", "10¹⁵ byte", "2⁵⁰ byte"] };
  function articolo(fam) { return { lunghezza: "una lunghezza", massa: "un peso", temperatura: "una temperatura", area: "un'area", volume: "un volume", velocita: "una velocità", dati: "una quantità di dati" }[fam]; }

  CV.unita = {
    U: U, FAMIGLIE: FAMIGLIE, ORDINE: ORDINE, CONTRO: CONTRO,
    leggi: leggi, trova: trovaUnita,
    /* il valore di base in un'unità: una frazione esatta */
    in: function (base, id) { return daBase(base, U[id]); },
    nome: nomeDi,
    /* quanto vale 1 «da» in «a», esatto; per la riga «come si calcola» */
    fattore: function (da, a) { var ua = U[da], ub = U[a]; if (ua.o || ub.o) return null; return Q.div(ua.f, ub.f); }
  };
})(typeof window !== "undefined" ? window : globalThis);
