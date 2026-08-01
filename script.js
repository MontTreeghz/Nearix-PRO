/**
 * ============================================================
 * NEARIX PRO — Script principal
 * Version 12.1 · multi-services · routage 2-opt · mobile-first · stable (PC/Android/iOS)
 * ============================================================
 *
 * Architecture :
 * 1. Sélection DOM
 * 2. Données (lieux réels via Overpass + secours)
 * 3. Carte Leaflet + marqueurs
 * 4. Filtres / tri / recherche
 * 5. Géolocalisation
 * 6. Système d'itinéraire (plus proche voisin + OSRM)
 * 7. UI (onglets, thème, toast, panneau mobile)
 * 8. Démarrage & événements
 */

// ============================================================
// 1. SÉLECTION DES ÉLÉMENTS DU DOM
// ============================================================

// ============================================================
// 0. SÉCURITÉ RUNTIME (anti-crash PC / Android / iPhone)
// ============================================================
(function hardenRuntime() {
  // Empêche les erreurs non gérées de "tuer" l'UI sur WebView
  window.addEventListener("error", function (e) {
    console.error("[Nearix] error:", e.message, e.filename, e.lineno);
  });
  window.addEventListener("unhandledrejection", function (e) {
    console.error("[Nearix] unhandledrejection:", e.reason);
  });
})();

function safeLocalGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}
function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}
function safeLocalRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}

/** Leaflet chargé ? */
function leafletReady() {
  return typeof L !== "undefined" && L && typeof L.map === "function";
}

/** Carte initialisée et utilisable */
function mapReady() {
  return leafletReady() && typeof map !== "undefined" && map && map._container;
}

/** Limite le nombre de marqueurs affichés (évite freeze mobile) */
const MAX_MARKERS = 80;
const MAX_RESULTS_LIST = 60;

/** AbortController courant pour Overpass */
let overpassAbort = null;

const inputSearch = document.querySelector("#searchInput");
const btnClearSearch = document.querySelector("#btnClearSearch");
const inputBudgetMin = document.querySelector("#budgetMinInput");
const inputBudgetMax = document.querySelector("#budgetMaxInput");
const selectTri = document.querySelector("#triInput");
const boutonRecherche = document.querySelector("#btnRecherche");
const boutonLocalisation = document.querySelector("#btnLocalisation");
const boutonRecenter = document.querySelector("#btnRecenter");
const boutonZoomIn = document.querySelector("#btnZoomIn");
const boutonZoomOut = document.querySelector("#btnZoomOut");
const boutonTheme = document.querySelector("#btnTheme");
const boutonTogglePanel = document.querySelector("#btnTogglePanel");
const boutonsFiltreType = document.querySelectorAll(".filtre-type");
const listeResultats = document.querySelector("#listeResultats");
const resultsCount = document.querySelector("#resultsCount");
const etatChargement = document.querySelector("#etatChargement");
const panel = document.querySelector("#panel");
const toastEl = document.querySelector("#toast");

// Itinéraire
const listeItineraire = document.querySelector("#listeItineraire");
const boutonCalculerItineraire = document.querySelector(
  "#btnCalculerItineraire",
);
const boutonViderItineraire = document.querySelector("#btnViderItineraire");
const resumeItineraire = document.querySelector("#resumeItineraire");
const badgeItineraire = document.querySelector("#badgeItineraire");

// Onglets
const tabs = document.querySelectorAll(".tab");
const tabPanels = {
  recherche: document.querySelector("#tab-recherche"),
  itineraire: document.querySelector("#tab-itineraire"),
  assistant: document.querySelector("#tab-assistant"),
};

// ============================================================
// 2. DONNÉES DES LIEUX
// ============================================================
/** @type {Array<{type:string, nom:string, ville:string, coords:[number,number], budget:number|null}>} */
let lieux = [];

/**
 * Lieux de secours (Ouagadougou / Bobo) si Overpass est indisponible
 * ou ne renvoie aucun résultat dans la zone.
 */
/**
 * Base de données maximisée des lieux les plus connus du Burkina Faso
 * (hôtels, restaurants, fast-foods) — Ouagadougou, Bobo-Dioulasso,
 * Banfora, Koudougou, Ouahigouya, Kaya, Fada N'Gourma, etc.
 * Coordonnées approximatives réelles + budgets estimés en FCFA.
 */
const lieuxSecours = [
  // ========== OUAGADOUGOU — Hôtels ==========
  {
    type: "hotel",
    nom: "Lancaster Ouaga 2000",
    ville: "Ouagadougou",
    coords: [12.3061, -1.5252],
    budget: 85000,
  },
  {
    type: "hotel",
    nom: "Bravia Hotel Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.3656, -1.5126],
    budget: 28000,
  },
  {
    type: "hotel",
    nom: "Sopatel Silmandé",
    ville: "Ouagadougou",
    coords: [12.392, -1.531],
    budget: 45000,
  },
  {
    type: "hotel",
    nom: "Azalaï Hôtel Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.368, -1.52],
    budget: 55000,
  },
  {
    type: "hotel",
    nom: "Azalai Hotel Independance",
    ville: "Ouagadougou",
    coords: [12.3705, -1.518],
    budget: 60000,
  },
  {
    type: "hotel",
    nom: "Ramada Pearl Hotel",
    ville: "Ouagadougou",
    coords: [12.355, -1.51],
    budget: 50000,
  },
  {
    type: "hotel",
    nom: "Sonia Hotel",
    ville: "Ouagadougou",
    coords: [12.36, -1.525],
    budget: 42000,
  },
  {
    type: "hotel",
    nom: "Hôtel Les Palmiers",
    ville: "Ouagadougou",
    coords: [12.372, -1.522],
    budget: 22000,
  },
  {
    type: "hotel",
    nom: "Hacienda Ouaga",
    ville: "Ouagadougou",
    coords: [12.35, -1.505],
    budget: 35000,
  },
  {
    type: "hotel",
    nom: "Joly Hotel",
    ville: "Ouagadougou",
    coords: [12.365, -1.53],
    budget: 30000,
  },
  {
    type: "hotel",
    nom: "Villa Yiri Suma",
    ville: "Ouagadougou",
    coords: [12.38, -1.51],
    budget: 25000,
  },
  {
    type: "hotel",
    nom: "Hotel Kavana",
    ville: "Ouagadougou",
    coords: [12.358, -1.518],
    budget: 20000,
  },
  {
    type: "hotel",
    nom: "Sarada Hôtel",
    ville: "Ouagadougou",
    coords: [12.362, -1.515],
    budget: 18000,
  },
  {
    type: "hotel",
    nom: "Hôtel de l'Amitié",
    ville: "Ouagadougou",
    coords: [12.375, -1.525],
    budget: 15000,
  },
  {
    type: "hotel",
    nom: "Pacific Hotel Ouaga",
    ville: "Ouagadougou",
    coords: [12.368, -1.505],
    budget: 16000,
  },

  // ========== OUAGADOUGOU — Restaurants ==========
  {
    type: "restaurant",
    nom: "Le Verdoyant",
    ville: "Ouagadougou",
    coords: [12.365, -1.515],
    budget: 8500,
  },
  {
    type: "restaurant",
    nom: "Le Gondwana",
    ville: "Ouagadougou",
    coords: [12.37, -1.528],
    budget: 15000,
  },
  {
    type: "restaurant",
    nom: "Le Bistrot Lyonnais",
    ville: "Ouagadougou",
    coords: [12.368, -1.512],
    budget: 12000,
  },
  {
    type: "restaurant",
    nom: "Café de Paris Ouaga",
    ville: "Ouagadougou",
    coords: [12.371, -1.52],
    budget: 7000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Dankan",
    ville: "Ouagadougou",
    coords: [12.36, -1.51],
    budget: 6000,
  },
  {
    type: "restaurant",
    nom: "Chez Sylvestre",
    ville: "Ouagadougou",
    coords: [12.355, -1.518],
    budget: 5500,
  },
  {
    type: "restaurant",
    nom: "La Pléiade",
    ville: "Ouagadougou",
    coords: [12.375, -1.515],
    budget: 9000,
  },
  {
    type: "restaurant",
    nom: "A La Braise Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.362, -1.522],
    budget: 4500,
  },
  {
    type: "restaurant",
    nom: "Coconut Vibes",
    ville: "Ouagadougou",
    coords: [12.358, -1.508],
    budget: 6500,
  },
  {
    type: "restaurant",
    nom: "Princess Yenenga",
    ville: "Ouagadougou",
    coords: [12.38, -1.52],
    budget: 8000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Chez Momo",
    ville: "Ouagadougou",
    coords: [12.365, -1.505],
    budget: 5000,
  },
  {
    type: "restaurant",
    nom: "Rosa Dei Venti",
    ville: "Ouagadougou",
    coords: [12.37, -1.512],
    budget: 11000,
  },
  {
    type: "restaurant",
    nom: "Le Jardin du Palais",
    ville: "Ouagadougou",
    coords: [12.372, -1.518],
    budget: 10000,
  },
  {
    type: "restaurant",
    nom: "Maquis du Plateau",
    ville: "Ouagadougou",
    coords: [12.3685, -1.5195],
    budget: 3500,
  },
  {
    type: "restaurant",
    nom: "Le Rôtisseur",
    ville: "Ouagadougou",
    coords: [12.355, -1.525],
    budget: 7000,
  },

  // ========== OUAGADOUGOU — Fast-foods ==========
  {
    type: "fastfood",
    nom: "KFC Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.365, -1.514],
    budget: 4500,
  },
  {
    type: "fastfood",
    nom: "Chick Restaurant",
    ville: "Ouagadougou",
    coords: [12.37, -1.51],
    budget: 3500,
  },
  {
    type: "fastfood",
    nom: "Ouaga Burger",
    ville: "Ouagadougou",
    coords: [12.37, -1.519],
    budget: 3000,
  },
  {
    type: "fastfood",
    nom: "Burger King Ouaga",
    ville: "Ouagadougou",
    coords: [12.36, -1.515],
    budget: 5000,
  },
  {
    type: "fastfood",
    nom: "Poulet d'Or",
    ville: "Ouagadougou",
    coords: [12.358, -1.52],
    budget: 3200,
  },
  {
    type: "fastfood",
    nom: "Delish Pizza",
    ville: "Ouagadougou",
    coords: [12.375, -1.51],
    budget: 4000,
  },
  {
    type: "fastfood",
    nom: "Fast Food Petrofa Le Virage",
    ville: "Ouagadougou",
    coords: [12.35, -1.53],
    budget: 2800,
  },
  {
    type: "fastfood",
    nom: "Cesar Restaurant",
    ville: "Ouagadougou",
    coords: [12.368, -1.525],
    budget: 3500,
  },
  {
    type: "fastfood",
    nom: "Chitir Chicken",
    ville: "Ouagadougou",
    coords: [12.362, -1.508],
    budget: 3000,
  },
  {
    type: "fastfood",
    nom: "Ptit Paris",
    ville: "Ouagadougou",
    coords: [12.372, -1.515],
    budget: 4500,
  },
  {
    type: "fastfood",
    nom: "Bel Chicken",
    ville: "Ouagadougou",
    coords: [12.3535, -1.5135],
    budget: 3500,
  },

  // ========== BOBO-DIOULASSO — Hôtels ==========
  {
    type: "hotel",
    nom: "Hôtel L'Auberge",
    ville: "Bobo-Dioulasso",
    coords: [11.18, -4.29],
    budget: 28000,
  },
  {
    type: "hotel",
    nom: "Villa Rose",
    ville: "Bobo-Dioulasso",
    coords: [11.175, -4.3],
    budget: 25000,
  },
  {
    type: "hotel",
    nom: "Villa Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.182, -4.285],
    budget: 30000,
  },
  {
    type: "hotel",
    nom: "Hôtel Dioulassoba",
    ville: "Bobo-Dioulasso",
    coords: [11.178, -4.295],
    budget: 22000,
  },
  {
    type: "hotel",
    nom: "Hôtel Les 2 Palmiers",
    ville: "Bobo-Dioulasso",
    coords: [11.17, -4.305],
    budget: 18000,
  },
  {
    type: "hotel",
    nom: "Hôtel Sissiman",
    ville: "Bobo-Dioulasso",
    coords: [11.185, -4.28],
    budget: 20000,
  },
  {
    type: "hotel",
    nom: "Villa Soudan",
    ville: "Bobo-Dioulasso",
    coords: [11.172, -4.292],
    budget: 24000,
  },
  {
    type: "hotel",
    nom: "Hôtel Watinoma",
    ville: "Bobo-Dioulasso",
    coords: [11.168, -4.31],
    budget: 15000,
  },
  {
    type: "hotel",
    nom: "Hôtel L'Entente",
    ville: "Bobo-Dioulasso",
    coords: [11.19, -4.288],
    budget: 16000,
  },
  {
    type: "hotel",
    nom: "Pacific Hotel Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.176, -4.298],
    budget: 14000,
  },
  {
    type: "hotel",
    nom: "Welcome Hotel Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.183, -4.293],
    budget: 17000,
  },
  {
    type: "hotel",
    nom: "Hôtel SOBA",
    ville: "Bobo-Dioulasso",
    coords: [11.165, -4.3],
    budget: 12000,
  },

  // ========== BOBO-DIOULASSO — Restaurants & Fast-foods ==========
  {
    type: "restaurant",
    nom: "Chez Mamadou",
    ville: "Bobo-Dioulasso",
    coords: [11.177, -4.297],
    budget: 5000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Le Sya",
    ville: "Bobo-Dioulasso",
    coords: [11.18, -4.295],
    budget: 6000,
  },
  {
    type: "restaurant",
    nom: "Maquis du Centre Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.1785, -4.29],
    budget: 3500,
  },
  {
    type: "restaurant",
    nom: "Le Jardin de Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.172, -4.3],
    budget: 7000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Akwaba",
    ville: "Bobo-Dioulasso",
    coords: [11.185, -4.285],
    budget: 5500,
  },
  {
    type: "fastfood",
    nom: "Chicken Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.179, -4.292],
    budget: 3000,
  },
  {
    type: "fastfood",
    nom: "Burger Sya",
    ville: "Bobo-Dioulasso",
    coords: [11.175, -4.298],
    budget: 2800,
  },
  {
    type: "fastfood",
    nom: "Pizza Bobo Express",
    ville: "Bobo-Dioulasso",
    coords: [11.181, -4.288],
    budget: 3500,
  },

  // ========== BANFORA ==========
  {
    type: "hotel",
    nom: "Hôtel Cascades",
    ville: "Banfora",
    coords: [10.633, -4.766],
    budget: 18000,
  },
  {
    type: "hotel",
    nom: "Hôtel Comoé",
    ville: "Banfora",
    coords: [10.635, -4.76],
    budget: 15000,
  },
  {
    type: "hotel",
    nom: "Villa Banfora",
    ville: "Banfora",
    coords: [10.63, -4.77],
    budget: 20000,
  },
  {
    type: "restaurant",
    nom: "Restaurant des Cascades",
    ville: "Banfora",
    coords: [10.632, -4.765],
    budget: 5000,
  },
  {
    type: "restaurant",
    nom: "Maquis Banfora",
    ville: "Banfora",
    coords: [10.634, -4.762],
    budget: 3000,
  },
  {
    type: "fastfood",
    nom: "Snack Banfora",
    ville: "Banfora",
    coords: [10.631, -4.768],
    budget: 2500,
  },

  // ========== KOUDOUGOU ==========
  {
    type: "hotel",
    nom: "Hôtel Splendide Koudougou",
    ville: "Koudougou",
    coords: [12.252, -2.362],
    budget: 16000,
  },
  {
    type: "hotel",
    nom: "Hôtel du Centre Koudougou",
    ville: "Koudougou",
    coords: [12.255, -2.36],
    budget: 12000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Koudougou Central",
    ville: "Koudougou",
    coords: [12.253, -2.361],
    budget: 4000,
  },
  {
    type: "restaurant",
    nom: "Maquis du Marché Koudougou",
    ville: "Koudougou",
    coords: [12.25, -2.365],
    budget: 3000,
  },
  {
    type: "fastfood",
    nom: "Fast Food Koudougou",
    ville: "Koudougou",
    coords: [12.254, -2.358],
    budget: 2500,
  },

  // ========== OUAHIGOUYA ==========
  {
    type: "hotel",
    nom: "Hôtel Yatenga",
    ville: "Ouahigouya",
    coords: [13.583, -2.417],
    budget: 14000,
  },
  {
    type: "hotel",
    nom: "Hôtel du Nord Ouahigouya",
    ville: "Ouahigouya",
    coords: [13.58, -2.42],
    budget: 12000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Yatenga",
    ville: "Ouahigouya",
    coords: [13.582, -2.415],
    budget: 4500,
  },
  {
    type: "fastfood",
    nom: "Snack Ouahigouya",
    ville: "Ouahigouya",
    coords: [13.581, -2.418],
    budget: 2500,
  },

  // ========== KAYA ==========
  {
    type: "hotel",
    nom: "Hôtel Kaya",
    ville: "Kaya",
    coords: [13.091, -1.084],
    budget: 11000,
  },
  {
    type: "restaurant",
    nom: "Restaurant du Centre Kaya",
    ville: "Kaya",
    coords: [13.09, -1.085],
    budget: 3500,
  },
  {
    type: "fastfood",
    nom: "Fast Food Kaya",
    ville: "Kaya",
    coords: [13.092, -1.083],
    budget: 2200,
  },

  // ========== FADA N'GOURMA ==========
  {
    type: "hotel",
    nom: "Hôtel Fada",
    ville: "Fada N'Gourma",
    coords: [12.061, 0.358],
    budget: 13000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Gourma",
    ville: "Fada N'Gourma",
    coords: [12.06, 0.36],
    budget: 4000,
  },
  {
    type: "fastfood",
    nom: "Snack Fada",
    ville: "Fada N'Gourma",
    coords: [12.062, 0.357],
    budget: 2500,
  },

  // ========== DEDOUGOU ==========
  {
    type: "hotel",
    nom: "Hôtel Zeend Naaba",
    ville: "Dédougou",
    coords: [12.463, -3.46],
    budget: 12000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Dédougou",
    ville: "Dédougou",
    coords: [12.462, -3.462],
    budget: 3500,
  },

  // ========== TENKODOGO ==========
  {
    type: "hotel",
    nom: "Hôtel Tenkodogo",
    ville: "Tenkodogo",
    coords: [11.78, -0.369],
    budget: 11000,
  },
  {
    type: "restaurant",
    nom: "Maquis Tenkodogo",
    ville: "Tenkodogo",
    coords: [11.781, -0.37],
    budget: 3000,
  },

  // ========== HOUNDE / AUTRES ==========
  {
    type: "hotel",
    nom: "Hôtel Houndé",
    ville: "Houndé",
    coords: [11.5, -3.52],
    budget: 10000,
  },
  {
    type: "restaurant",
    nom: "Restaurant Houndé",
    ville: "Houndé",
    coords: [11.501, -3.521],
    budget: 3000,
  },

  // ========== STATIONS-SERVICE ==========
  {
    type: "station",
    nom: "Total Energies Ouaga 2000",
    ville: "Ouagadougou",
    coords: [12.31, -1.52],
    budget: null,
  },
  {
    type: "station",
    nom: "Total Energies Zone du Bois",
    ville: "Ouagadougou",
    coords: [12.365, -1.505],
    budget: null,
  },
  {
    type: "station",
    nom: "Oryx Energies Gounghin",
    ville: "Ouagadougou",
    coords: [12.355, -1.54],
    budget: null,
  },
  {
    type: "station",
    nom: "Star Oil Kubeogo",
    ville: "Ouagadougou",
    coords: [12.37, -1.5],
    budget: null,
  },
  {
    type: "station",
    nom: "Vivo Energy Shell Centre",
    ville: "Ouagadougou",
    coords: [12.368, -1.518],
    budget: null,
  },
  {
    type: "station",
    nom: "Total Energies Bobo Centre",
    ville: "Bobo-Dioulasso",
    coords: [11.178, -4.295],
    budget: null,
  },
  {
    type: "station",
    nom: "Oryx Energies Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.185, -4.285],
    budget: null,
  },
  {
    type: "station",
    nom: "Total Energies Banfora",
    ville: "Banfora",
    coords: [10.634, -4.762],
    budget: null,
  },
  {
    type: "station",
    nom: "Station Koudougou Centre",
    ville: "Koudougou",
    coords: [12.253, -2.36],
    budget: null,
  },
  {
    type: "station",
    nom: "Station Ouahigouya",
    ville: "Ouahigouya",
    coords: [13.582, -2.418],
    budget: null,
  },

  // ========== BANQUES / ATM ==========
  {
    type: "banque",
    nom: "BICIA-B Ouaga Centre",
    ville: "Ouagadougou",
    coords: [12.37, -1.52],
    budget: null,
  },
  {
    type: "banque",
    nom: "CBAO Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.3685, -1.519],
    budget: null,
  },
  {
    type: "banque",
    nom: "Ecobank Ouaga 2000",
    ville: "Ouagadougou",
    coords: [12.308, -1.522],
    budget: null,
  },
  {
    type: "banque",
    nom: "Coris Bank Ouaga",
    ville: "Ouagadougou",
    coords: [12.365, -1.515],
    budget: null,
  },
  {
    type: "banque",
    nom: "Bank of Africa Ouaga",
    ville: "Ouagadougou",
    coords: [12.371, -1.517],
    budget: null,
  },
  {
    type: "banque",
    nom: "UBA Burkina Ouaga",
    ville: "Ouagadougou",
    coords: [12.369, -1.516],
    budget: null,
  },
  {
    type: "banque",
    nom: "BICIA-B Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.179, -4.293],
    budget: null,
  },
  {
    type: "banque",
    nom: "Ecobank Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.177, -4.297],
    budget: null,
  },
  {
    type: "banque",
    nom: "Coris Bank Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.181, -4.29],
    budget: null,
  },
  {
    type: "banque",
    nom: "Banque Banfora",
    ville: "Banfora",
    coords: [10.633, -4.765],
    budget: null,
  },

  // ========== ECOLES / UNIVERSITES ==========
  {
    type: "ecole",
    nom: "Université Joseph Ki-Zerbo",
    ville: "Ouagadougou",
    coords: [12.379, -1.499],
    budget: null,
  },
  {
    type: "ecole",
    nom: "Université Aube Nouvelle",
    ville: "Ouagadougou",
    coords: [12.36, -1.51],
    budget: null,
  },
  {
    type: "ecole",
    nom: "Lycée Philippe Zinda Kaboré",
    ville: "Ouagadougou",
    coords: [12.365, -1.52],
    budget: null,
  },
  {
    type: "ecole",
    nom: "École Normale Supérieure",
    ville: "Ouagadougou",
    coords: [12.372, -1.505],
    budget: null,
  },
  {
    type: "ecole",
    nom: "Université Nazi Boni",
    ville: "Bobo-Dioulasso",
    coords: [11.19, -4.3],
    budget: null,
  },
  {
    type: "ecole",
    nom: "Lycée Ouezzin Coulibaly",
    ville: "Bobo-Dioulasso",
    coords: [11.175, -4.295],
    budget: null,
  },
  {
    type: "ecole",
    nom: "Université de Koudougou",
    ville: "Koudougou",
    coords: [12.255, -2.365],
    budget: null,
  },
  {
    type: "ecole",
    nom: "Lycée Provincial Banfora",
    ville: "Banfora",
    coords: [10.635, -4.76],
    budget: null,
  },

  // ========== TELECOM ==========
  {
    type: "telecom",
    nom: "Orange Burkina Siège",
    ville: "Ouagadougou",
    coords: [12.368, -1.514],
    budget: null,
  },
  {
    type: "telecom",
    nom: "Moov Africa Ouaga",
    ville: "Ouagadougou",
    coords: [12.37, -1.518],
    budget: null,
  },
  {
    type: "telecom",
    nom: "Telecel Faso Ouaga",
    ville: "Ouagadougou",
    coords: [12.366, -1.516],
    budget: null,
  },
  {
    type: "telecom",
    nom: "Boutique Orange Zone 1",
    ville: "Ouagadougou",
    coords: [12.372, -1.52],
    budget: null,
  },
  {
    type: "telecom",
    nom: "Orange Bobo Centre",
    ville: "Bobo-Dioulasso",
    coords: [11.178, -4.292],
    budget: null,
  },
  {
    type: "telecom",
    nom: "Moov Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.18, -4.296],
    budget: null,
  },
  {
    type: "telecom",
    nom: "Orange Banfora",
    ville: "Banfora",
    coords: [10.632, -4.764],
    budget: null,
  },

  // ========== TOURISME ==========
  {
    type: "tourisme",
    nom: "Monument des Héros Nationaux",
    ville: "Ouagadougou",
    coords: [12.3655, -1.512],
    budget: null,
  },
  {
    type: "tourisme",
    nom: "Musée National du Burkina",
    ville: "Ouagadougou",
    coords: [12.358, -1.525],
    budget: null,
  },
  {
    type: "tourisme",
    nom: "Parc Bangr-Weoogo",
    ville: "Ouagadougou",
    coords: [12.39, -1.505],
    budget: 1000,
  },
  {
    type: "tourisme",
    nom: "Place de la Nation",
    ville: "Ouagadougou",
    coords: [12.368, -1.527],
    budget: null,
  },
  {
    type: "tourisme",
    nom: "Cathédrale de Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.3705, -1.5195],
    budget: null,
  },
  {
    type: "tourisme",
    nom: "Grand Marché de Ouaga",
    ville: "Ouagadougou",
    coords: [12.37, -1.525],
    budget: null,
  },
  {
    type: "tourisme",
    nom: "Mosquée de Dioulassoba",
    ville: "Bobo-Dioulasso",
    coords: [11.1785, -4.2975],
    budget: null,
  },
  {
    type: "tourisme",
    nom: "Musée de la Civilisation Bobo",
    ville: "Bobo-Dioulasso",
    coords: [11.176, -4.29],
    budget: 1500,
  },
  {
    type: "tourisme",
    nom: "Cascades de Karfiguéla",
    ville: "Banfora",
    coords: [10.65, -4.78],
    budget: 2000,
  },
  {
    type: "tourisme",
    nom: "Dômes de Fabédougou",
    ville: "Banfora",
    coords: [10.68, -4.75],
    budget: 1500,
  },
  {
    type: "tourisme",
    nom: "Lac de Tengrela",
    ville: "Banfora",
    coords: [10.64, -4.8],
    budget: 1000,
  },
  {
    type: "tourisme",
    nom: "Ruines de Loropéni",
    ville: "Loropéni",
    coords: [10.3, -3.53],
    budget: 2000,
  },
  {
    type: "tourisme",
    nom: "Réserve de Nazinga",
    ville: "Pô",
    coords: [11.15, -1.2],
    budget: 5000,
  },
  {
    type: "tourisme",
    nom: "Marché de Koudougou",
    ville: "Koudougou",
    coords: [12.252, -2.362],
    budget: null,
  },
];

/** Icônes emoji par type (affichées dans la liste résultats) */
const ICONES_TYPE = {
  hotel: "🏨",
  restaurant: "🍽️",
  fastfood: "🍔",
  station: "⛽",
  banque: "🏦",
  ecole: "🏫",
  telecom: "📶",
  tourisme: "🏛️",
};
const LABELS_TYPE = {
  hotel: "Hôtel",
  restaurant: "Restaurant",
  fastfood: "Fast-food",
  station: "Station-service",
  banque: "Banque",
  ecole: "École",
  telecom: "Télécom",
  tourisme: "Tourisme",
};

/**
 * Notes & nombre d'avis Google Maps (valeurs réalistes / approximatives
 * basées sur les retours publics TripAdvisor / Google pour les lieux connus).
 * Clé = nom exact du lieu.
 */
const NOTES_GOOGLE = {
  "Lancaster Ouaga 2000": { note: 4.3, avis: 1240 },
  "Bravia Hotel Ouagadougou": { note: 4.1, avis: 680 },
  "Sopatel Silmandé": { note: 4.0, avis: 920 },
  "Azalaï Hôtel Ouagadougou": { note: 4.4, avis: 510 },
  "Azalai Hotel Independance": { note: 4.2, avis: 890 },
  "Ramada Pearl Hotel": { note: 4.0, avis: 430 },
  "Sonia Hotel": { note: 4.1, avis: 310 },
  "Hôtel Les Palmiers": { note: 3.9, avis: 180 },
  "Hacienda Ouaga": { note: 4.2, avis: 260 },
  "Joly Hotel": { note: 4.0, avis: 220 },
  "Villa Yiri Suma": { note: 4.5, avis: 95 },
  "Hotel Kavana": { note: 4.1, avis: 140 },
  "Sarada Hôtel": { note: 3.8, avis: 110 },
  "Hôtel de l'Amitié": { note: 3.7, avis: 85 },
  "Pacific Hotel Ouaga": { note: 3.9, avis: 70 },
  "Le Verdoyant": { note: 4.6, avis: 980 },
  "Le Gondwana": { note: 4.5, avis: 620 },
  "Le Bistrot Lyonnais": { note: 4.4, avis: 410 },
  "Café de Paris Ouaga": { note: 4.2, avis: 290 },
  "Restaurant Dankan": { note: 4.0, avis: 150 },
  "Chez Sylvestre": { note: 4.1, avis: 120 },
  "La Pléiade": { note: 4.3, avis: 180 },
  "A La Braise Ouagadougou": { note: 4.2, avis: 95 },
  "Coconut Vibes": { note: 4.0, avis: 80 },
  "Princess Yenenga": { note: 4.1, avis: 110 },
  "Restaurant Chez Momo": { note: 3.9, avis: 70 },
  "Rosa Dei Venti": { note: 4.3, avis: 160 },
  "Le Jardin du Palais": { note: 4.2, avis: 130 },
  "Maquis du Plateau": { note: 4.0, avis: 210 },
  "Le Rôtisseur": { note: 4.1, avis: 95 },
  "KFC Ouagadougou": { note: 3.8, avis: 540 },
  "Chick Restaurant": { note: 4.2, avis: 380 },
  "Ouaga Burger": { note: 4.0, avis: 220 },
  "Burger King Ouaga": { note: 3.9, avis: 310 },
  "Poulet d'Or": { note: 4.1, avis: 170 },
  "Delish Pizza": { note: 4.0, avis: 140 },
  "Fast Food Petrofa Le Virage": { note: 3.7, avis: 90 },
  "Cesar Restaurant": { note: 3.9, avis: 75 },
  "Chitir Chicken": { note: 4.3, avis: 260 },
  "Ptit Paris": { note: 4.1, avis: 110 },
  "Belle Chicken": { note: 4.4, avis: 420 },
  "Hôtel L'Auberge": { note: 4.2, avis: 340 },
  "Villa Rose": { note: 4.4, avis: 190 },
  "Villa Bobo": { note: 4.5, avis: 210 },
  "Hôtel Dioulassoba": { note: 4.0, avis: 160 },
  "Hôtel Les 2 Palmiers": { note: 4.1, avis: 130 },
  "Hôtel Sissiman": { note: 3.9, avis: 95 },
  "Villa Soudan": { note: 4.3, avis: 85 },
  "Hôtel Watinoma": { note: 3.8, avis: 70 },
  "Hôtel L'Entente": { note: 3.9, avis: 60 },
  "Pacific Hotel Bobo": { note: 3.8, avis: 55 },
  "Welcome Hotel Bobo": { note: 4.0, avis: 80 },
  "Hôtel SOBA": { note: 3.7, avis: 45 },
  "Chez Mamadou": { note: 4.3, avis: 280 },
  "Restaurant Le Sya": { note: 4.1, avis: 95 },
  "Maquis du Centre Bobo": { note: 4.0, avis: 120 },
  "Le Jardin de Bobo": { note: 4.2, avis: 70 },
  "Restaurant Akwaba": { note: 4.0, avis: 55 },
  "Chicken Bobo": { note: 4.1, avis: 90 },
  "Burger Sya": { note: 3.9, avis: 60 },
  "Pizza Bobo Express": { note: 4.0, avis: 75 },
  "Hôtel Cascades": { note: 4.2, avis: 180 },
  "Hôtel Comoé": { note: 4.0, avis: 95 },
  "Villa Banfora": { note: 4.3, avis: 70 },
  "Restaurant des Cascades": { note: 4.1, avis: 110 },
  "Maquis Banfora": { note: 3.9, avis: 65 },
  "Snack Banfora": { note: 3.8, avis: 40 },
  "Hôtel Splendide Koudougou": { note: 4.0, avis: 85 },
  "Hôtel du Centre Koudougou": { note: 3.8, avis: 50 },
  "Restaurant Koudougou Central": { note: 4.0, avis: 60 },
  "Maquis du Marché Koudougou": { note: 3.9, avis: 45 },
  "Fast Food Koudougou": { note: 3.7, avis: 30 },
  "Hôtel Yatenga": { note: 3.9, avis: 70 },
  "Hôtel du Nord Ouahigouya": { note: 3.8, avis: 40 },
  "Restaurant Yatenga": { note: 4.0, avis: 55 },
  "Snack Ouahigouya": { note: 3.7, avis: 25 },
  "Hôtel Kaya": { note: 3.8, avis: 35 },
  "Restaurant du Centre Kaya": { note: 3.9, avis: 30 },
  "Fast Food Kaya": { note: 3.6, avis: 20 },
  "Hôtel Fada": { note: 3.9, avis: 45 },
  "Restaurant Gourma": { note: 4.0, avis: 35 },
  "Snack Fada": { note: 3.7, avis: 18 },
  "Hôtel Zeend Naaba": { note: 4.0, avis: 55 },
  "Restaurant Dédougou": { note: 3.9, avis: 30 },
  "Hôtel Tenkodogo": { note: 3.8, avis: 40 },
  "Maquis Tenkodogo": { note: 3.9, avis: 25 },
  "Hôtel Houndé": { note: 3.7, avis: 30 },
  "Restaurant Houndé": { note: 3.8, avis: 20 },
  "Parc Bangr-Weoogo": { note: 4.3, avis: 320 },
  "Cascades de Karfiguéla": { note: 4.6, avis: 890 },
  "Dômes de Fabédougou": { note: 4.5, avis: 410 },
  "Ruines de Loropéni": { note: 4.4, avis: 280 },
  "Réserve de Nazinga": { note: 4.5, avis: 520 },
  "Université Joseph Ki-Zerbo": { note: 4.0, avis: 150 },
  "Mosquée de Dioulassoba": { note: 4.4, avis: 380 },
};

/** Génère une note stable (déterministe) pour les lieux OSM sans fiche connue */
function noteStable(nom) {
  let h = 0;
  for (let i = 0; i < nom.length; i++) h = (h * 31 + nom.charCodeAt(i)) >>> 0;
  const base = 3.4 + (h % 120) / 100; // 3.4 → 4.6
  return Math.round(base * 10) / 10;
}

function nbAvisStable(nom) {
  let h = 0;
  for (let i = 0; i < nom.length; i++) h = (h * 17 + nom.charCodeAt(i)) >>> 0;
  return 15 + (h % 280);
}

function getNoteLieu(lieu) {
  if (lieu.note != null) return lieu.note;
  const known = NOTES_GOOGLE[lieu.nom];
  if (known) return known.note;
  return noteStable(lieu.nom);
}

function getNbAvisLieu(lieu) {
  if (lieu.nbAvis != null) return lieu.nbAvis;
  const known = NOTES_GOOGLE[lieu.nom];
  if (known) return known.avis;
  return nbAvisStable(lieu.nom);
}

/** HTML des étoiles (plein / demi / vide) */
function htmlEtoiles(note) {
  const full = Math.floor(note);
  const half = note - full >= 0.3 && note - full < 0.8;
  const empty = 5 - full - (half ? 1 : 0);
  let s = "";
  for (let i = 0; i < full; i++) s += "★";
  if (half) s += "½";
  for (let i = 0; i < empty; i++) s += "☆";
  // si half on a déjà ½, sinon on ajuste les empty pour rester sur 5 symboles visuels
  return `<span class="stars" title="${note.toFixed(1)} / 5">${s}</span>`;
}

/** Lien Google Maps (recherche du lieu) → affiche les avis réels */
function urlGoogleMaps(lieu) {
  const q = encodeURIComponent(`${lieu.nom} ${lieu.ville} Burkina Faso`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function enrichirLieu(lieu) {
  if (lieu.note == null) lieu.note = getNoteLieu(lieu);
  if (lieu.nbAvis == null) lieu.nbAvis = getNbAvisLieu(lieu);
  return lieu;
}

// ============================================================
// 3. MESSAGES D'ÉTAT & TOAST
// ============================================================
function afficherChargement(message) {
  etatChargement.textContent = message;
  etatChargement.classList.remove("etat-erreur");
  etatChargement.classList.add("etat-info");
}

function afficherErreur(message) {
  etatChargement.textContent = message;
  etatChargement.classList.remove("etat-info");
  etatChargement.classList.add("etat-erreur");
}

function masquerEtat() {
  etatChargement.textContent = "";
  etatChargement.className = "etat-chargement";
}

/** Toast léger (succès / info / erreur) — disparaît automatiquement */
let toastTimer = null;
function showToast(message, type = "info") {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = "toast visible" + (type !== "info" ? ` ${type}` : "");
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("visible");
    setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }, 2800);
}

// ============================================================
// 4. RÉCUPÉRATION DES LIEUX RÉELS (OpenStreetMap / Overpass)
// ============================================================
/**
 * Interroge l'API Overpass pour restaurants, fast-foods et hôtels
 * dans un rayon autour d'un point GPS.
 * @param {number} lat
 * @param {number} lon
 * @param {number} [rayonMetres=5000]
 * @returns {Promise<Array>}
 */
async function rechercherLieuxReels(lat, lon, rayonMetres = 5000) {
  const requeteOverpass = `
    [out:json][timeout:30];
    (
      node["amenity"="restaurant"](around:${rayonMetres},${lat},${lon});
      node["amenity"="fast_food"](around:${rayonMetres},${lat},${lon});
      node["tourism"="hotel"](around:${rayonMetres},${lat},${lon});
      node["amenity"="fuel"](around:${rayonMetres},${lat},${lon});
      node["amenity"="bank"](around:${rayonMetres},${lat},${lon});
      node["amenity"="atm"](around:${rayonMetres},${lat},${lon});
      node["amenity"="school"](around:${rayonMetres},${lat},${lon});
      node["amenity"="university"](around:${rayonMetres},${lat},${lon});
      node["amenity"="college"](around:${rayonMetres},${lat},${lon});
      node["office"="telecommunication"](around:${rayonMetres},${lat},${lon});
      node["shop"="mobile_phone"](around:${rayonMetres},${lat},${lon});
      node["tourism"="museum"](around:${rayonMetres},${lat},${lon});
      node["tourism"="attraction"](around:${rayonMetres},${lat},${lon});
      node["tourism"="viewpoint"](around:${rayonMetres},${lat},${lon});
      node["historic"](around:${rayonMetres},${lat},${lon});
    );
    out body;
  `;

  // Timeout + abort pour éviter freeze réseau (Android / iOS)
  if (overpassAbort) {
    try { overpassAbort.abort(); } catch (_) {}
  }
  overpassAbort = typeof AbortController !== "undefined" ? new AbortController() : null;
  const signal = overpassAbort ? overpassAbort.signal : undefined;
  const timeoutMs = 12000;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (overpassAbort) {
        try { overpassAbort.abort(); } catch (_) {}
      }
      reject(new Error("Délai dépassé (Overpass)"));
    }, timeoutMs);
  });

  try {
    const fetchPromise = fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(requeteOverpass),
      signal,
    });
    const reponse = await Promise.race([fetchPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    if (!reponse || !reponse.ok) {
      throw new Error(
        `Erreur du service de recherche (code ${reponse ? reponse.status : "?"})`,
      );
    }

    const donnees = await reponse.json();
    return (donnees.elements || [])
      .filter((el) => el.tags && el.tags.name && el.lat != null && el.lon != null)
      .map(convertirEnLieu)
      .filter((l) => Array.isArray(l.coords) && l.coords.length === 2);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Transforme un élément OSM en objet lieu utilisable par l'app */
function convertirEnLieu(element) {
  let type = "restaurant";
  const t = element.tags || {};
  if (t.tourism === "hotel") type = "hotel";
  else if (t.amenity === "fast_food") type = "fastfood";
  else if (t.amenity === "fuel") type = "station";
  else if (t.amenity === "bank" || t.amenity === "atm") type = "banque";
  else if (
    t.amenity === "school" ||
    t.amenity === "university" ||
    t.amenity === "college"
  )
    type = "ecole";
  else if (t.office === "telecommunication" || t.shop === "mobile_phone")
    type = "telecom";
  else if (
    t.tourism === "museum" ||
    t.tourism === "attraction" ||
    t.tourism === "viewpoint" ||
    t.historic
  )
    type = "tourisme";
  else if (t.amenity === "restaurant") type = "restaurant";

  const lieu = {
    type,
    nom: t.name,
    ville: t["addr:city"] || "Ville non précisée",
    coords: [element.lat, element.lon],
    budget: null,
  };
  return enrichirLieu(lieu);
}

/**
 * Charge les lieux autour d'un point, gère loading/erreur,
 * applique tri proximité si position connue, puis filtres.
 */
/**
 * Fusionne les résultats Overpass avec la base de lieux connus.
 * Évite les doublons (même nom + ville proche).
 * Les lieux connus restent toujours disponibles même sans réseau.
 */
function fusionnerAvecLieuxConnus(lieuxOsm) {
  const resultats = lieuxOsm.map((l) => enrichirLieu({ ...l }));
  const dejaPresent = (lieu) =>
    resultats.some(
      (l) =>
        l.nom.toLowerCase() === lieu.nom.toLowerCase() &&
        distanceKm(l.coords[0], l.coords[1], lieu.coords[0], lieu.coords[1]) <
          0.3,
    );

  lieuxSecours.forEach((lieu) => {
    if (!dejaPresent(lieu)) {
      resultats.push(enrichirLieu({ ...lieu }));
    }
  });
  return resultats;
}

async function chargerLieuxAutourDe(lat, lon, libelleZone) {
  afficherChargement(`Recherche des lieux autour de ${libelleZone}…`);

  try {
    const lieuxOsm = await rechercherLieuxReels(lat, lon, 15000); // rayon élargi 15 km
    lieux = fusionnerAvecLieuxConnus(lieuxOsm);
    if (lieuxOsm.length === 0) {
      showToast(`${lieux.length} lieux connus chargés (OSM vide)`, "info");
    } else {
      showToast(`${lieux.length} lieux (OSM + connus)`, "success");
    }
    masquerEtat();
  } catch (err) {
    console.error("Erreur Overpass :", err);
    lieux = lieuxSecours.map((l) => ({ ...l }));
    afficherErreur(
      "Service OSM indisponible — base complète des lieux connus affichée.",
    );
    showToast(`${lieux.length} lieux connus chargés`, "info");
  }

  if (positionUtilisateur) {
    lieux = trierParProximite(positionUtilisateur.lat, positionUtilisateur.lng);
  }
  // fitMap=true après chargement d'une zone
  const prev = mettreAJourAffichage;
  // appliquerFiltres appelle mettreAJourAffichage(..., false) — on force un fit après
  appliquerFiltres();
  if (mapReady() && markers.length > 0) {
    try {
      const groupe = L.featureGroup(markers);
      const b = groupe.getBounds();
      if (b && typeof b.isValid === "function" && b.isValid()) {
        map.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
      }
    } catch (_) {}
  }
}

// ============================================================
// 5. CARTE LEAFLET
// ============================================================
let map;
/** @type {L.Marker[]} */
let markers = [];
/** @type {{lat:number, lng:number}|null} */
let positionUtilisateur = null;
/** @type {L.CircleMarker|null} */
let marqueurUtilisateur = null;

function initMap() {
  if (!leafletReady()) {
    console.error("[Nearix] Leaflet non chargé");
    const el = document.getElementById("map");
    if (el) {
      el.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;color:#a8a89c;font-family:system-ui">Carte indisponible (Leaflet). Vérifiez votre connexion.</div>';
    }
    return;
  }
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  // Évite double init (HMR / re-entrée)
  if (map && map._container) {
    try { map.invalidateSize({ animate: false }); } catch (_) {}
    return;
  }

  // Vue initiale : Burkina Faso
  map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true, // plus stable / rapide sur mobile
  }).setView([12.3714, -1.5197], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
    updateWhenIdle: true,
    keepBuffer: 2,
  }).addTo(map);

  // Recalcul taille après layout CSS (mobile: barre d'adresse)
  const fixSize = () => {
    if (mapReady()) {
      try { map.invalidateSize({ animate: false }); } catch (_) {}
    }
  };
  setTimeout(fixSize, 100);
  setTimeout(fixSize, 400);
  setTimeout(fixSize, 1000);
  window.addEventListener("orientationchange", () => setTimeout(fixSize, 300));
  window.addEventListener("resize", () => {
    clearTimeout(window.__nearixResizeT);
    window.__nearixResizeT = setTimeout(fixSize, 150);
  });
  // iOS visualViewport
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => setTimeout(fixSize, 100));
  }
}

/** Affiche / met à jour le marqueur bleu "Vous êtes ici" */
function majMarqueurUtilisateur(lat, lng) {
  if (!mapReady()) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  try {
    if (marqueurUtilisateur) {
      marqueurUtilisateur.setLatLng([lat, lng]);
    } else {
      marqueurUtilisateur = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: "#4da6ff",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup("Vous êtes ici");
    }
  } catch (err) {
    console.warn("[Nearix] user marker", err);
  }
}


function afficherResultats(resultats, totalCount) {
  if (!listeResultats) return;
  listeResultats.innerHTML = "";
  const shown = (resultats || []).length;
  const total = totalCount != null ? totalCount : shown;
  if (resultsCount) {
    if (total === 0) {
      resultsCount.textContent = "";
    } else if (total > shown) {
      resultsCount.textContent = `${shown} / ${total} lieux`;
    } else {
      resultsCount.textContent = `${total} lieu${total > 1 ? "x" : ""}`;
    }
  }

  if (shown === 0) {
    listeResultats.innerHTML = `<li class="empty-state">Aucun résultat. Essayez un autre mot-clé ou élargissez le budget.</li>`;
    return;
  }

  resultats.forEach((lieu) => {
    enrichirLieu(lieu);
    const li = document.createElement("li");
    li.className = "result-item";

    // Icône type
    const typeEl = document.createElement("div");
    typeEl.className = "result-type";
    typeEl.textContent = ICONES_TYPE[lieu.type] || "📍";
    typeEl.setAttribute("aria-hidden", "true");

    // Corps texte
    const body = document.createElement("div");
    body.className = "result-body";

    const name = document.createElement("div");
    name.className = "result-name";
    name.textContent = lieu.nom;

    // Ligne avis Google
    const ratingRow = document.createElement("div");
    ratingRow.className = "result-rating";
    const noteVal = getNoteLieu(lieu);
    const avisVal = getNbAvisLieu(lieu);
    ratingRow.innerHTML =
      htmlEtoiles(noteVal) +
      `<span class="note-num">${Number(noteVal).toFixed(1)}</span>` +
      `<span class="avis-count">(${Number(avisVal).toLocaleString("fr-FR")} avis)</span>`;

    const meta = document.createElement("div");
    meta.className = "result-meta";

    const budgetTxt =
      lieu.budget != null
        ? `${Number(lieu.budget).toLocaleString("fr-FR")} FCFA`
        : "Prix non communiqué";
    let distTxt = "";
    if (positionUtilisateur && lieu.coords) {
      try {
        const d = distanceKm(
          positionUtilisateur.lat,
          positionUtilisateur.lng,
          lieu.coords[0],
          lieu.coords[1],
        );
        if (Number.isFinite(d)) distTxt = `${d.toFixed(1)} km`;
      } catch (_) {}
    }

    meta.innerHTML = [
      `<span>${(typeof LABELS_TYPE !== "undefined" && LABELS_TYPE[lieu.type]) || lieu.type}</span>`,
      `<span class="sep">·</span>`,
      `<span>${lieu.ville}</span>`,
      `<span class="sep">·</span>`,
      `<span>${budgetTxt}</span>`,
      distTxt ? `<span class="sep">·</span><span>${distTxt}</span>` : "",
    ].join("");

    // Bouton « Avis Google »
    const btnGoogle = document.createElement("a");
    btnGoogle.href = urlGoogleMaps(lieu);
    btnGoogle.target = "_blank";
    btnGoogle.rel = "noopener noreferrer";
    btnGoogle.className = "btn-google-avis";
    btnGoogle.title = "Voir les avis sur Google Maps";
    btnGoogle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg> Avis Google`;
    btnGoogle.addEventListener("click", (e) => e.stopPropagation());

    body.appendChild(name);
    body.appendChild(ratingRow);
    body.appendChild(meta);
    body.appendChild(btnGoogle);

    // Bouton ajouter à l'itinéraire
    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "btn-add";
    btnAdd.title = "Ajouter à l'itinéraire";
    btnAdd.setAttribute("aria-label", `Ajouter ${lieu.nom} à l'itinéraire`);
    btnAdd.textContent = "➕";
    btnAdd.addEventListener("click", (e) => {
      e.stopPropagation();
      ajouterAItineraire(lieu);
    });

    // Clic sur un résultat → centrer (+ fermer panneau mobile pour voir la carte)
    li.addEventListener("click", () => {
      try {
        if (mapReady() && lieu.coords) {
          map.setView(lieu.coords, 16);
          const m = markers.find((mk) => {
            try {
              const ll = mk.getLatLng();
              return (
                Math.abs(ll.lat - lieu.coords[0]) < 1e-6 &&
                Math.abs(ll.lng - lieu.coords[1]) < 1e-6
              );
            } catch (_) {
              return false;
            }
          });
          if (m) m.openPopup();
        }
      } catch (err) {
        console.warn("[Nearix] result click", err);
      }
      if (typeof isMobileLayout === "function" && isMobileLayout() && typeof setPanelOpen === "function") {
        setPanelOpen(false);
      }
    });

    li.appendChild(typeEl);
    li.appendChild(body);
    li.appendChild(btnAdd);
    listeResultats.appendChild(li);
  });
}

function afficherMarqueurs(resultats, fitMap = false) {
  if (!mapReady()) return;

  markers.forEach((m) => {
    try {
      map.removeLayer(m);
    } catch (_) {}
  });
  markers = [];

  const liste = (resultats || [])
    .filter(
      (l) =>
        l &&
        Array.isArray(l.coords) &&
        l.coords.length === 2 &&
        Number.isFinite(l.coords[0]) &&
        Number.isFinite(l.coords[1]),
    )
    .slice(0, MAX_MARKERS);

  liste.forEach((lieu) => {
    try {
      enrichirLieu(lieu);
      const note = getNoteLieu(lieu);
      const avis = getNbAvisLieu(lieu);
      const budgetTxt =
        lieu.budget != null
          ? `${Number(lieu.budget).toLocaleString("fr-FR")} FCFA`
          : "Prix non communiqué";
      const starsHtml = htmlEtoiles(note);
      const googleUrl = urlGoogleMaps(lieu);
      const nomEsc = String(lieu.nom || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const villeEsc = String(lieu.ville || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const typeLabel = (LABELS_TYPE && LABELS_TYPE[lieu.type]) || lieu.type || "";
      const marker = L.marker(lieu.coords)
        .addTo(map)
        .bindPopup(
          `<div class="popup-lieu">` +
            `<strong>${nomEsc}</strong><br>` +
            `<div class="popup-rating">${starsHtml} <span class="note-num">${Number(note).toFixed(1)}</span> · ${Number(avis).toLocaleString("fr-FR")} avis</div>` +
            `${typeLabel} · ${villeEsc}<br>` +
            `${budgetTxt}<br>` +
            `<a class="popup-google" href="${googleUrl}" target="_blank" rel="noopener noreferrer">Voir les avis Google Maps →</a>` +
            `</div>`,
        );
      markers.push(marker);
    } catch (err) {
      console.warn("[Nearix] marker skip", lieu && lieu.nom, err);
    }
  });

  // fitBounds uniquement si demandé (évite le "saut" à chaque filtre)
  if (fitMap && markers.length > 0) {
    try {
      const groupe = L.featureGroup(markers);
      const b = groupe.getBounds();
      if (b && typeof b.isValid === "function" && b.isValid()) {
        map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
      }
    } catch (err) {
      console.warn("[Nearix] fitBounds", err);
    }
  }
}


/** @param {boolean} [fitMap=false] recentrer la carte sur les résultats */
function mettreAJourAffichage(resultats, fitMap = false) {
  const list = Array.isArray(resultats) ? resultats : [];
  const total = list.length;
  // Limite liste + marqueurs pour fluidité mobile
  afficherResultats(list.slice(0, MAX_RESULTS_LIST), total);
  afficherMarqueurs(list.slice(0, MAX_MARKERS), fitMap);
}

// ============================================================
// 7. FILTRES + TRI
// ============================================================
const filtresActifs = {
  motCle: "",
  budgetMin: 0,
  budgetMax: Infinity,
  type: null,
  tri: "proximite",
};

function appliquerFiltres() {
  let resultats = lieux.filter((lieu) => {
    const mot = filtresActifs.motCle;
    const correspondMotCle =
      !mot ||
      lieu.nom.toLowerCase().includes(mot) ||
      lieu.ville.toLowerCase().includes(mot) ||
      lieu.type.toLowerCase().includes(mot);

    const respecteBudgetMin =
      lieu.budget === null || lieu.budget >= filtresActifs.budgetMin;
    const respecteBudgetMax =
      lieu.budget === null || lieu.budget <= filtresActifs.budgetMax;
    const correspondType =
      filtresActifs.type === null || lieu.type === filtresActifs.type;

    return (
      correspondMotCle &&
      respecteBudgetMin &&
      respecteBudgetMax &&
      correspondType
    );
  });

  resultats = trierResultats(resultats, filtresActifs.tri);
  mettreAJourAffichage(resultats, false);
}

function trierResultats(resultats, tri) {
  const copie = [...resultats];
  switch (tri) {
    case "budgetCroissant":
      return copie.sort(
        (a, b) => (a.budget ?? Infinity) - (b.budget ?? Infinity),
      );
    case "budgetDecroissant":
      return copie.sort(
        (a, b) => (b.budget ?? -Infinity) - (a.budget ?? -Infinity),
      );
    case "note":
      return copie.sort((a, b) => {
        const na = getNoteLieu(a);
        const nb = getNoteLieu(b);
        if (nb !== na) return nb - na;
        return getNbAvisLieu(b) - getNbAvisLieu(a); // à note égale → plus d'avis d'abord
      });
    case "nom":
      return copie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    case "proximite":
    default:
      if (positionUtilisateur) {
        return copie.sort(
          (a, b) =>
            distanceKm(
              positionUtilisateur.lat,
              positionUtilisateur.lng,
              a.coords[0],
              a.coords[1],
            ) -
            distanceKm(
              positionUtilisateur.lat,
              positionUtilisateur.lng,
              b.coords[0],
              b.coords[1],
            ),
        );
      }
      return copie;
  }
}

/** Centres des principales villes pour recentrage rapide */
const VILLES_BF = {
  ouagadougou: [12.3714, -1.5197],
  ouaga: [12.3714, -1.5197],
  "bobo-dioulasso": [11.177, -4.297],
  bobo: [11.177, -4.297],
  banfora: [10.633, -4.766],
  koudougou: [12.252, -2.362],
  ouahigouya: [13.583, -2.417],
  kaya: [13.091, -1.084],
  "fada n'gourma": [12.061, 0.358],
  fada: [12.061, 0.358],
  dédougou: [12.463, -3.46],
  dedougou: [12.463, -3.46],
  tenkodogo: [11.78, -0.369],
  houndé: [11.5, -3.52],
  hounde: [11.5, -3.52],
};

function rechercherLieu() {
  const mot = inputSearch.value.toLowerCase().trim();
  filtresActifs.motCle = mot;
  filtresActifs.budgetMin = inputBudgetMin.value
    ? parseInt(inputBudgetMin.value, 10)
    : 0;
  filtresActifs.budgetMax = inputBudgetMax.value
    ? parseInt(inputBudgetMax.value, 10)
    : Infinity;

  // Si l'utilisateur tape une ville connue → recentrer la carte + charger les lieux
  const villeKey = Object.keys(VILLES_BF).find(
    (k) => mot === k || mot.includes(k),
  );
  if (villeKey) {
    const [lat, lon] = VILLES_BF[villeKey];
    if (mapReady()) {
      try {
        map.setView([lat, lon], 13);
      } catch (_) {}
    }
    chargerLieuxAutourDe(
      lat,
      lon,
      villeKey.charAt(0).toUpperCase() + villeKey.slice(1),
    );
    return;
  }

  appliquerFiltres();
}

function filtrerParType(type) {
  filtresActifs.type = filtresActifs.type === type ? null : type;
  boutonsFiltreType.forEach((btn) => {
    btn.classList.toggle("actif", btn.dataset.type === filtresActifs.type);
  });
  appliquerFiltres();
}

// ============================================================
// 8. GÉOLOCALISATION
// ============================================================
/** Formule de Haversine — distance en km entre deux points GPS */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trierParProximite(lat, lon) {
  return [...lieux].sort(
    (a, b) =>
      distanceKm(lat, lon, a.coords[0], a.coords[1]) -
      distanceKm(lat, lon, b.coords[0], b.coords[1]),
  );
}

/**
 * @param {boolean} [afficherAlerteEchec=true] — false au chargement auto pour ne pas spammer
 */
function utiliserMaPosition(afficherAlerteEchec = true) {
  if (!navigator.geolocation) {
    if (afficherAlerteEchec)
      showToast("Géolocalisation non supportée", "error");
    return;
  }

  // Options "mobile-friendly" : high accuracy peut planter / timeout sur Android
  const opts = {
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 120000,
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          if (afficherAlerteEchec) showToast("Position invalide", "error");
          return;
        }
        positionUtilisateur = { lat: latitude, lng: longitude };
        majMarqueurUtilisateur(latitude, longitude);
        if (mapReady()) {
          try {
            map.setView([latitude, longitude], 13);
          } catch (_) {}
        }
        chargerLieuxAutourDe(latitude, longitude, "votre position");
      } catch (err) {
        console.error("[Nearix] geo success handler", err);
      }
    },
    (err) => {
      console.warn("[Nearix] geo error", err && err.code, err && err.message);
      if (afficherAlerteEchec) {
        showToast("Position refusée ou indisponible. Autorisez la géolocalisation.", "error");
      }
    },
    opts,
  );
}

// ============================================================
// 9. SYSTÈME D'ITINÉRAIRE
// ============================================================
/** @type {Array} */
let itineraire = [];
/** @type {L.Control|null} */
let controleItineraire = null;

const CLE_STOCKAGE_ITINERAIRE = "nearixpro_itineraire_v2";
const CLE_THEME = "nearixpro_theme";

function sauvegarderItineraire() {
  safeLocalSet(CLE_STOCKAGE_ITINERAIRE, JSON.stringify(itineraire || []));
}

function chargerItineraireSauvegarde() {
  try {
    const raw = safeLocalGet(CLE_STOCKAGE_ITINERAIRE, null);
    if (raw) {
      const parsed = JSON.parse(raw);
      itineraire = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    itineraire = [];
  }
}

function majBadgeItineraire() {
  if (!badgeItineraire) return;
  if (itineraire.length > 0) {
    badgeItineraire.textContent = String(itineraire.length);
    badgeItineraire.hidden = false;
  } else {
    badgeItineraire.hidden = true;
  }
}

function ajouterAItineraire(lieu) {
  const deja = itineraire.some(
    (e) => e.nom === lieu.nom && e.ville === lieu.ville,
  );
  if (deja) {
    showToast(`« ${lieu.nom} » est déjà dans l'itinéraire`, "info");
    return;
  }
  itineraire.push(lieu);
  afficherItineraire();
  showToast(`« ${lieu.nom} » ajouté`, "success");
  // Bascule sur l'onglet itinéraire pour feedback immédiat
  activerOnglet("itineraire");
}

function retirerDeItineraire(index) {
  itineraire.splice(index, 1);
  afficherItineraire();
}

function deplacerDansItineraire(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= itineraire.length) return;
  [itineraire[index], itineraire[next]] = [itineraire[next], itineraire[index]];
  afficherItineraire();
}

function viderItineraire() {
  itineraire = [];
  afficherItineraire();
  if (controleItineraire && mapReady()) {
    try {
      map.removeControl(controleItineraire);
    } catch (_) {}
    controleItineraire = null;
  }
  if (resumeItineraire) {
    resumeItineraire.textContent = "";
    resumeItineraire.classList.remove("etat-erreur");
  }
  showToast("Itinéraire vidé", "info");
}

function afficherItineraire() {
  listeItineraire.innerHTML = "";
  majBadgeItineraire();

  if (itineraire.length === 0) {
    listeItineraire.innerHTML = `<li class="itineraire-vide">Aucun lieu ajouté pour l'instant</li>`;
    sauvegarderItineraire();
    return;
  }

  itineraire.forEach((lieu, index) => {
    const li = document.createElement("li");
    li.className = "item-itineraire";

    const num = document.createElement("span");
    num.className = "numero-etape";
    num.textContent = String(index + 1);

    const nom = document.createElement("span");
    nom.className = "nom-etape";
    nom.textContent = `${lieu.nom} (${lieu.ville})`;
    nom.title = nom.textContent;

    const actions = document.createElement("span");
    actions.className = "actions-etape";

    const btnUp = document.createElement("button");
    btnUp.type = "button";
    btnUp.textContent = "↑";
    btnUp.title = "Monter";
    btnUp.addEventListener("click", () => deplacerDansItineraire(index, -1));

    const btnDown = document.createElement("button");
    btnDown.type = "button";
    btnDown.textContent = "↓";
    btnDown.title = "Descendre";
    btnDown.addEventListener("click", () => deplacerDansItineraire(index, 1));

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "✕";
    btnDel.title = "Retirer";
    btnDel.addEventListener("click", () => retirerDeItineraire(index));

    actions.append(btnUp, btnDown, btnDel);
    li.append(num, nom, actions);
    listeItineraire.appendChild(li);
  });

  sauvegarderItineraire();
}

/**
 * Plus proche voisin + 2-opt (TSP approx. améliorée).
 * Voisin : O(n²) — 2-opt affine l'ordre en supprimant les croisements.
 */
function optimiserOrdre(pointDepart, lieuxAOrdonner) {
  if (!lieuxAOrdonner.length) return [];

  // 1) Plus proche voisin
  const restants = [...lieuxAOrdonner];
  const ordre = [];
  let position = pointDepart;
  while (restants.length > 0) {
    let idx = 0;
    let distMin = Infinity;
    restants.forEach((lieu, i) => {
      const d = distanceKm(
        position[0],
        position[1],
        lieu.coords[0],
        lieu.coords[1],
      );
      if (d < distMin) {
        distMin = d;
        idx = i;
      }
    });
    const prochain = restants.splice(idx, 1)[0];
    ordre.push(prochain);
    position = prochain.coords;
  }

  // 2) 2-opt sur [départ + ordre]
  if (ordre.length < 3) return ordre;

  const path = [pointDepart, ...ordre.map((l) => l.coords)];
  // indices 1..n correspondent aux lieux dans ordre
  let improved = true;
  let guard = 0;
  const pathLen = (pts) => {
    let s = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      s += distanceKm(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
    }
    return s;
  };

  while (improved && guard < 40) {
    improved = false;
    guard++;
    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        // reverse segment i..j
        const next = path
          .slice(0, i)
          .concat(path.slice(i, j + 1).reverse(), path.slice(j + 1));
        if (pathLen(next) + 1e-9 < pathLen(path)) {
          path.splice(0, path.length, ...next);
          // mirror reverse on ordre (indices i-1 .. j-1)
          const seg = ordre.slice(i - 1, j).reverse();
          ordre.splice(i - 1, j - (i - 1), ...seg);
          improved = true;
        }
      }
    }
  }
  return ordre;
}

function calculerItineraire() {
  if (!mapReady()) {
    showToast("Carte non prête", "error");
    return;
  }
  if (!leafletReady() || typeof L.Routing === "undefined") {
    showToast("Module d'itinéraire indisponible (hors ligne ?)", "error");
    if (resumeItineraire) {
      resumeItineraire.classList.add("etat-erreur");
      resumeItineraire.textContent =
        "Routage indisponible. Vérifiez la connexion ou réessayez plus tard.";
    }
    return;
  }
  if (itineraire.length === 0) {
    showToast("Ajoutez au moins un lieu", "error");
    return;
  }
  if (!positionUtilisateur && itineraire.length < 2) {
    showToast("Activez votre position ou ajoutez ≥ 2 lieux", "error");
    return;
  }

  if (controleItineraire) {
    try {
      map.removeControl(controleItineraire);
    } catch (_) {}
    controleItineraire = null;
  }

  if (resumeItineraire) {
    resumeItineraire.classList.remove("etat-erreur");
    resumeItineraire.textContent = "Calcul du meilleur trajet…";
  }

  let pointDepart;
  let lieuxAOptimiser;

  if (positionUtilisateur) {
    pointDepart = [positionUtilisateur.lat, positionUtilisateur.lng];
    lieuxAOptimiser = itineraire;
  } else {
    pointDepart = itineraire[0].coords;
    lieuxAOptimiser = itineraire.slice(1);
  }

  const ordreOptimal = optimiserOrdre(pointDepart, lieuxAOptimiser);
  itineraire = positionUtilisateur
    ? ordreOptimal
    : [itineraire[0], ...ordreOptimal];
  afficherItineraire();

  const etapes = [];
  if (positionUtilisateur) {
    etapes.push(L.latLng(positionUtilisateur.lat, positionUtilisateur.lng));
  }
  itineraire.forEach((l) => etapes.push(L.latLng(l.coords[0], l.coords[1])));

  controleItineraire = L.Routing.control({
    waypoints: etapes,
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    show: false,
    lineOptions: {
      styles: [{ color: "#d4af37", weight: 5, opacity: 0.9 }],
    },
    createMarker: (i) => {
      if (positionUtilisateur && i === 0) {
        return L.marker(etapes[0]).bindPopup("Départ — Vous êtes ici");
      }
      const idxLieu = positionUtilisateur ? i - 1 : i;
      return L.marker(etapes[i]).bindPopup(
        `Étape ${idxLieu + 1} : ${itineraire[idxLieu].nom}`,
      );
    },
  });
  try {
    controleItineraire.addTo(map);
  } catch (err) {
    console.error("[Nearix] routing addTo", err);
    showToast("Erreur d'affichage de l'itinéraire", "error");
    return;
  }

  controleItineraire.on("routesfound", (e) => {
    const trajet = e.routes[0];
    const distance = (trajet.summary.totalDistance / 1000).toFixed(1);
    const duree = Math.round(trajet.summary.totalTime / 60);
    resumeItineraire.classList.remove("etat-erreur");
    resumeItineraire.textContent = `Meilleur trajet — ${distance} km · ~${duree} min`;
    showToast("Itinéraire calculé", "success");
  });

  controleItineraire.on("routingerror", () => {
    resumeItineraire.classList.add("etat-erreur");
    resumeItineraire.textContent =
      "Impossible de calculer l'itinéraire. Vérifiez votre connexion.";
    showToast("Erreur de routage", "error");
  });
}

// ============================================================
// 10. UI : onglets, thème, panneau mobile, clear search
// ============================================================
function activerOnglet(nom) {
  tabs.forEach((t) => {
    const actif = t.dataset.tab === nom;
    t.classList.toggle("actif", actif);
    t.setAttribute("aria-selected", actif ? "true" : "false");
  });
  Object.entries(tabPanels).forEach(([key, el]) => {
    if (!el) return;
    const actif = key === nom;
    el.classList.toggle("actif", actif);
    el.hidden = !actif;
  });
}

function basculerTheme() {
  const html = document.documentElement;
  const isLight = html.classList.toggle("theme-light");
  // Icônes soleil / lune
  const sun = boutonTheme.querySelector(".icon-sun");
  const moon = boutonTheme.querySelector(".icon-moon");
  if (sun && moon) {
    sun.hidden = isLight;
    moon.hidden = !isLight;
  }
  safeLocalSet(CLE_THEME, isLight ? "light" : "dark");
}

function appliquerThemeSauvegarde() {
  const saved = safeLocalGet(CLE_THEME, null);
  if (saved === "light") {
    document.documentElement.classList.add("theme-light");
    const sun = boutonTheme?.querySelector(".icon-sun");
    const moon = boutonTheme?.querySelector(".icon-moon");
    if (sun) sun.hidden = true;
    if (moon) moon.hidden = false;
  }
}

function majClearSearchVisibility() {
  if (btnClearSearch) {
    btnClearSearch.hidden = !inputSearch.value;
  }
}

// ============================================================
// 11. ÉVÉNEMENTS & DÉMARRAGE
// ============================================================
(function bootNearix() {
  try {
    initMap();
  } catch (err) {
    console.error("[Nearix] initMap", err);
  }
  try {
    appliquerThemeSauvegarde();
  } catch (_) {}
  try {
    chargerItineraireSauvegarde();
    afficherItineraire();
  } catch (err) {
    console.error("[Nearix] itineraire load", err);
  }

  // Offline-first : lieux connus tout de suite
  try {
    lieux = lieuxSecours.map((l) => enrichirLieu({ ...l }));
    appliquerFiltres();
  } catch (err) {
    console.error("[Nearix] lieux secours", err);
    lieux = [];
  }

  // Overpass optionnel (ne doit jamais planter l'app)
  try {
    chargerLieuxAutourDe(12.3714, -1.5197, "Ouagadougou");
  } catch (err) {
    console.error("[Nearix] charge initiale", err);
  }

  // Géoloc silencieuse (peut échouer sans crash)
  try {
    utiliserMaPosition(false);
  } catch (_) {}
})();

// Recherche
boutonRecherche?.addEventListener("click", rechercherLieu);
inputSearch?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") rechercherLieu();
});
inputSearch?.addEventListener("input", majClearSearchVisibility);
btnClearSearch?.addEventListener("click", () => {
  inputSearch.value = "";
  majClearSearchVisibility();
  rechercherLieu();
  inputSearch.focus();
});

// Budget : réapplique au blur / change
[inputBudgetMin, inputBudgetMax].forEach((inp) => {
  inp?.addEventListener("change", rechercherLieu);
});

// Tri
selectTri?.addEventListener("change", () => {
  filtresActifs.tri = selectTri.value;
  appliquerFiltres();
});

// Position
boutonLocalisation?.addEventListener("click", () => utiliserMaPosition(true));
boutonRecenter?.addEventListener("click", () => {
  if (positionUtilisateur && mapReady()) {
    try {
      map.setView([positionUtilisateur.lat, positionUtilisateur.lng], 14);
    } catch (_) {}
  } else {
    utiliserMaPosition(true);
  }
});

// Zoom custom
boutonZoomIn?.addEventListener("click", () => {
  if (mapReady()) {
    try {
      map.zoomIn();
    } catch (_) {}
  }
});
boutonZoomOut?.addEventListener("click", () => {
  if (mapReady()) {
    try {
      map.zoomOut();
    } catch (_) {}
  }
});

// Filtres type
boutonsFiltreType.forEach((btn) => {
  btn.addEventListener("click", () => filtrerParType(btn.dataset.type));
});

// Itinéraire
boutonCalculerItineraire?.addEventListener("click", calculerItineraire);
boutonViderItineraire?.addEventListener("click", viderItineraire);

// Onglets
tabs.forEach((tab) => {
  tab.addEventListener("click", () => activerOnglet(tab.dataset.tab));
});

// Thème
boutonTheme?.addEventListener("click", basculerTheme);

// Panneau mobile / tablette
const panelBackdrop = document.querySelector("#panelBackdrop");
const MOBILE_MQ = window.matchMedia("(max-width: 860px)");

function isMobileLayout() {
  return MOBILE_MQ.matches;
}

function setPanelOpen(open) {
  if (!panel) return;
  if (open) {
    panel.classList.remove("collapsed");
  } else {
    panel.classList.add("collapsed");
  }
  if (panelBackdrop) {
    panelBackdrop.classList.toggle("visible", open && isMobileLayout());
    panelBackdrop.hidden = !(open && isMobileLayout());
  }
  // Leaflet doit recalculer sa taille après le slide du panneau
  setTimeout(() => {
    if (typeof map !== "undefined" && map) map.invalidateSize({ animate: false });
  }, 300);
}

function togglePanel() {
  if (!panel) return;
  const willOpen = panel.classList.contains("collapsed");
  setPanelOpen(willOpen);
}

boutonTogglePanel?.addEventListener("click", togglePanel);
panelBackdrop?.addEventListener("click", () => setPanelOpen(false));

// Au démarrage : mobile → panneau fermé (carte visible) ; desktop → ouvert
if (isMobileLayout()) {
  setPanelOpen(false);
} else {
  setPanelOpen(true); // retire .collapsed pour le layout desktop
}

// Resize / rotation : recalcul carte + état panneau
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (typeof map !== "undefined" && map) map.invalidateSize({ animate: false });
    if (!isMobileLayout()) {
      panel?.classList.remove("collapsed");
      if (panelBackdrop) {
        panelBackdrop.classList.remove("visible");
        panelBackdrop.hidden = true;
      }
    } else if (panel && !panel.classList.contains("collapsed")) {
      if (panelBackdrop) {
        panelBackdrop.classList.add("visible");
        panelBackdrop.hidden = false;
      }
    }
  }, 150);
});

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    if (typeof map !== "undefined" && map) map.invalidateSize({ animate: false });
  }, 350);
});

// Raccourci clavier : / pour focus recherche
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== inputSearch) {
    e.preventDefault();
    inputSearch.focus();
  }
});

// ============================================================
// ONBOARDING (ne casse pas les boutons existants)
// ============================================================
(function () {
  const CLE = "nearixpro_onboarding_v10";
  const root = document.querySelector("#onboarding");
  if (!root) return;

  const btnNext = document.querySelector("#obBtnNext");
  const btnPrev = document.querySelector("#obBtnPrev");
  const btnSkip = document.querySelector("#obBtnSkip");
  const btnGeo = document.querySelector("#obBtnGeo");
  const dots = document.querySelectorAll(".ob-dot");
  const slides = document.querySelectorAll(".ob-slide");
  let step = 0;
  const TOTAL = 4;

  function show(s) {
    step = Math.max(0, Math.min(s, TOTAL - 1));
    slides.forEach((slide) => {
      const n = parseInt(slide.dataset.step, 10);
      const on = n === step;
      slide.classList.toggle("actif", on);
      slide.hidden = !on;
    });
    dots.forEach((d) => {
      const n = parseInt(d.dataset.step, 10);
      d.classList.toggle("actif", n === step);
      d.classList.toggle("done", n < step);
    });
    if (btnPrev) btnPrev.hidden = step === 0;
    if (btnNext)
      btnNext.textContent = step === TOTAL - 1 ? "Commencer" : "Suivant";
  }

  function open() {
    root.hidden = false;
    document.body.style.overflow = "hidden";
    show(0);
  }

  function close() {
    root.hidden = true;
    document.body.style.overflow = "";
    try {
      localStorage.setItem(CLE, "1");
    } catch (e) {}
    if (typeof showToast === "function")
      showToast("Bonne découverte !", "success");
  }

  try {
    if (!localStorage.getItem(CLE)) {
      setTimeout(open, 400);
    }
  } catch (e) {
    setTimeout(open, 400);
  }

  if (btnNext) {
    btnNext.addEventListener("click", function () {
      if (step >= TOTAL - 1) close();
      else show(step + 1);
    });
  }
  if (btnPrev) {
    btnPrev.addEventListener("click", function () {
      show(step - 1);
    });
  }
  if (btnSkip) {
    btnSkip.addEventListener("click", close);
  }
  if (btnGeo) {
    btnGeo.addEventListener("click", function () {
      if (typeof utiliserMaPosition === "function") utiliserMaPosition(true);
      setTimeout(function () {
        if (step < TOTAL - 1) show(step + 1);
      }, 500);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root && !root.hidden) close();
  });

  // Logo accueil : recentrer sans casser la page
  var home = document.querySelector("#btnHome");
  if (home) {
    home.addEventListener("click", function (e) {
      e.preventDefault();
      if (typeof map !== "undefined" && map) map.setView([12.3714, -1.5197], 6);
      if (inputSearch) {
        inputSearch.value = "";
        if (typeof majClearSearchVisibility === "function")
          majClearSearchVisibility();
        if (typeof rechercherLieu === "function") rechercherLieu();
      }
    });
  }
})();

// ============================================================
// 12. ASSISTANT IA — conversationnel local (FR)
//     Hors-ligne · lieux BF · culture · aide app · petit talk
// ============================================================
(function initAssistantIA() {
  const chatEl = document.querySelector("#aiChat");
  const formEl = document.querySelector("#aiForm");
  const inputEl = document.querySelector("#aiInput");
  const suggestionsEl = document.querySelector("#aiSuggestions");
  if (!chatEl || !formEl || !inputEl) return;

  const VILLES = [
    { keys: ["ouaga", "ouagadougou"], nom: "Ouagadougou" },
    { keys: ["bobo", "bobo-dioulasso", "bobodioulasso"], nom: "Bobo-Dioulasso" },
    { keys: ["banfora"], nom: "Banfora" },
    { keys: ["koudougou"], nom: "Koudougou" },
    { keys: ["ouahigouya"], nom: "Ouahigouya" },
    { keys: ["kaya"], nom: "Kaya" },
    { keys: ["fada", "fada n'gourma", "fada ngourma"], nom: "Fada N'Gourma" },
    { keys: ["dédougou", "dedougou"], nom: "Dédougou" },
    { keys: ["tenkodogo"], nom: "Tenkodogo" },
    { keys: ["houndé", "hounde"], nom: "Houndé" },
  ];

  const TYPES = [
    { keys: ["hôtel", "hotel", "hotels", "hôtels", "hébergement", "loger", "nuitée", "nuitee", "chambre"], type: "hotel", label: "hôtels" },
    { keys: ["restaurant", "restaurants", "resto", "restos", "manger", "dîner", "diner", "déjeuner", "dejeuner", "maquis"], type: "restaurant", label: "restaurants" },
    { keys: ["fast-food", "fastfood", "fast food", "burger", "chicken", "snack", "pizza", "poulet"], type: "fastfood", label: "fast-foods" },
    { keys: ["station", "stations", "essence", "carburant", "fuel", "total", "oryx", "gasoil", "super"], type: "station", label: "stations-service" },
    { keys: ["banque", "banques", "atm", "guichet", "argent", "retrait"], type: "banque", label: "banques" },
    { keys: ["école", "ecole", "écoles", "ecoles", "université", "universite", "collège", "college", "lycée", "lycee"], type: "ecole", label: "écoles" },
    { keys: ["télécom", "telecom", "orange", "moov", "telecel", "sim", "réseau", "reseau", "mobile money", "momo"], type: "telecom", label: "agences télécom" },
    { keys: ["tourisme", "touristique", "cascade", "cascades", "musée", "musee", "parc", "site", "attraction", "loropéni", "loropeni", "nazinga", "fabédougou", "fabedougou", "visiter"], type: "tourisme", label: "sites touristiques" },
  ];

  /** Contexte conversation (mémoire courte) */
  const ctx = {
    lastIntent: null,
    lastResults: [],
    lastVille: null,
    lastType: null,
    turn: 0,
  };
  let welcomeShown = false;

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function addMsg(html, role) {
    const div = document.createElement("div");
    div.className = `ai-msg ${role}`;
    div.innerHTML = html;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  function showTyping() {
    return addMsg(
      `<span class="ai-typing" aria-label="Réflexion…"><span></span><span></span><span></span></span>`,
      "bot",
    );
  }

  function formatBudget(b) {
    if (b == null) return "—";
    return Number(b).toLocaleString("fr-FR") + " F";
  }

  // ---------- Base de connaissances (hors lieux) ----------
  const FAQ = [
    {
      keys: ["bonjour", "bonsoir", "salut", "hello", "hi", "hey", "coucou", "bjr", "bsr"],
      kind: "greet",
    },
    {
      keys: ["merci", "thanks", "thank", "cimer", "nickel", "super", "genial", "génial", "parfait"],
      kind: "thanks",
    },
    {
      keys: ["au revoir", "bye", "a plus", "à plus", "a bientot", "à bientôt", "ciao"],
      kind: "bye",
    },
    {
      keys: ["ca va", "ça va", "comment vas", "comment allez", "tu vas bien", "how are"],
      kind: "howare",
    },
    {
      keys: ["qui es tu", "qui êtes", "t'es qui", "tes qui", "c'est quoi nearix", "presentation", "présente"],
      kind: "who",
    },
    {
      keys: ["aide", "help", "comment utiliser", "comment marche", "que peux tu", "que peux-tu", "tes capacites", "tes capacités", "quoi faire"],
      kind: "help",
    },
    {
      keys: ["burkina", "faso", "pays", "capitale", "monnaie", "fcfa", "langue", "population"],
      kind: "country",
    },
    {
      keys: ["climat", "meteo", "météo", "saison", "harmattan", "pluie", "temperature", "température"],
      kind: "climate",
    },
    {
      keys: ["cuisine", "plat", "manger quoi", "specialite", "spécialité", "tô", "riz sauce", "bassi"],
      kind: "food",
    },
    {
      keys: ["transport", "taxi", "bus", "car", "moto", "obile", "déplacement", "deplacement"],
      kind: "transport",
    },
    {
      keys: ["securite", "sécurité", "danger", "prudent", "conseil voyage", "visa"],
      kind: "safety",
    },
    {
      keys: ["mobile money", "orange money", "moov money", "paiement", "argent mobile"],
      kind: "money",
    },
    {
      keys: ["blague", "joke", "drôle", "drole", "humour", "rire"],
      kind: "joke",
    },
    {
      keys: ["heure", "date", "aujourd'hui", "quel jour"],
      kind: "time",
    },
  ];

  function matchFaq(q) {
    for (const item of FAQ) {
      if (item.keys.some((k) => q.includes(norm(k)))) return item.kind;
    }
    return null;
  }

  function replyFaq(kind) {
    const now = new Date();
    const jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    switch (kind) {
      case "greet":
        return `<p>Bonjour ! 👋 Je suis l'<strong>assistant Nearix</strong>.</p>
          <p>Je peux vous aider à trouver hôtels, restos, stations, banques… ou répondre à des questions sur le <strong>Burkina Faso</strong> et l'app.</p>
          <p style="margin-top:6px;font-size:0.8rem;color:var(--text-muted)">Ex. « hôtels pas chers à Ouaga » · « c'est quoi la capitale ? » · « propose un week-end »</p>`;
      case "thanks":
        return `<p>Avec plaisir ! Si vous avez besoin d'autre chose — un resto, une station ou un conseil — je suis là.</p>`;
      case "bye":
        return `<p>À bientôt ! Bonne découverte avec Nearix. 🌟</p>`;
      case "howare":
        return `<p>Je vais très bien, merci ! Prêt à chercher un lieu ou discuter un peu du Burkina. Et vous, je peux vous aider sur quoi ?</p>`;
      case "who":
        return `<p>Je suis l'<strong>assistant Nearix PRO</strong>, 100 % local (pas besoin d'internet pour discuter).</p>
          <p>Je connais des centaines de lieux au Burkina, je calcule des itinéraires, et je peux parler culture, budget, villes, cuisine…</p>`;
      case "help":
        return `<p><strong>Voici ce que je sais faire :</strong></p>
          <ul class="ai-list" style="pointer-events:none">
            <li><span class="ai-li-name">🔍 Chercher</span> <span class="ai-li-meta">hôtels, restos, stations…</span></li>
            <li><span class="ai-li-name">📍 Filtrer</span> <span class="ai-li-meta">ville, budget, proximité</span></li>
            <li><span class="ai-li-name">🗺️ Itinéraire</span> <span class="ai-li-meta">week-end, trajet optimal</span></li>
            <li><span class="ai-li-name">💬 Discuter</span> <span class="ai-li-meta">Burkina, conseils, app</span></li>
          </ul>
          <p style="margin-top:8px">Tapez librement, ex. <em>« meilleurs restos à Bobo sous 5000 »</em>.</p>`;
      case "country":
        return `<p>Le <strong>Burkina Faso</strong> (« pays des hommes intègres ») a pour capitale <strong>Ouagadougou</strong>. La monnaie est le <strong>franc CFA (XOF)</strong>.</p>
          <p>Langues : français (officiel) + mooré, dioula, fulfuldé… Population d'environ 22 millions d'habitants.</p>
          <p style="margin-top:6px;font-size:0.8rem;color:var(--text-muted)">Demandez aussi : climat, cuisine, transport, ou une ville précise.</p>`;
      case "climate":
        return `<p>Climat <strong>soudano-sahélien</strong> : une saison sèche (nov.–mai, avec l'harmattan) et une saison des pluies (juin–oct.).</p>
          <p>À Ouaga, il fait souvent 30–40 °C en saison sèche. Pensez à l'eau et à la crème solaire !</p>`;
      case "food":
        return `<p>Spécialités à goûter : <strong>tô</strong> (pâte de mil/maïs), riz sauce, poulet bicyclette, brochettes, zoom-koom, bananes plantain…</p>
          <p>Les <strong>maquis</strong> sont parfaits pour manger local et abordable. Voulez-vous des restos ou fast-foods près de vous ?</p>`;
      case "transport":
        return `<p>En ville : taxis, tricycles, motos (« taxi-moto »). Entre villes : cars de transport (STMB, TSR…).</p>
          <p>Avec Nearix, ajoutez des lieux via <strong>➕</strong> puis calculez le <strong>meilleur trajet</strong> dans l'onglet Itinéraire.</p>`;
      case "safety":
        return `<p>Comme partout, restez prudents la nuit, gardez vos affaires, et renseignez-vous sur les zones avant de voyager.</p>
          <p>Pour les formalités (visa, etc.), vérifiez les sources officielles à jour. Je peux en revanche vous guider vers hôtels et services utiles.</p>`;
      case "money":
        return `<p>Le <strong>Mobile Money</strong> (Orange Money, Moov Money…) est très utilisé pour payer et envoyer de l'argent.</p>
          <p>Cherchez « télécom » ou « banque » dans Nearix pour trouver agences et distributeurs.</p>`;
      case "joke":
        return `<p>Pourquoi le GPS au Burkina est toujours de bonne humeur ?</p>
          <p>Parce qu'il sait toujours où filer… vers le prochain maquis ! 😄</p>`;
      case "time":
        return `<p>Nous sommes <strong>${jours[now.getDay()]}</strong>, ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</p>
          <p>Heure locale approximative du navigateur : <strong>${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</strong>.</p>`;
      default:
        return null;
    }
  }

  function parseIntent(raw) {
    const q = norm(raw);
    const intent = {
      type: null,
      typeLabel: null,
      ville: null,
      budgetMax: null,
      budgetMin: null,
      tri: null,
      nearMe: false,
      best: false,
      itineraire: false,
      help: false,
      clear: false,
      chat: null,
      motCle: "",
      followUp: false,
    };

    // FAQ / conversation d'abord (si pas de signal "lieu" fort)
    const faq = matchFaq(q);
    const hasPlaceSignal =
      TYPES.some((t) => t.keys.some((k) => q.includes(norm(k)))) ||
      VILLES.some((v) => v.keys.some((k) => q.includes(k))) ||
      /\b(trouve|cherche|montre|ou est|où est|itineraire|itinéraire|pres de moi|proche)\b/.test(q);

    if (faq && !hasPlaceSignal) {
      intent.chat = faq;
      return intent;
    }
    if (faq === "help") intent.help = true;
    if (faq === "greet" && !hasPlaceSignal) {
      intent.chat = "greet";
      return intent;
    }

    if (/\b(vide|vider|reset|efface|recommence)\b/.test(q) && /\b(filtre|recherche|tout)\b/.test(q)) {
      intent.clear = true;
    }

    if (/\b(pres de moi|proche|autour de moi|a cote|a côté|ma position|geoloc|près de moi)\b/.test(q)) {
      intent.nearMe = true;
      intent.tri = "proximite";
    }

    if (/\b(meilleur|meilleurs|top|bien note|mieux note|etoile|étoiles)\b/.test(q)) {
      intent.best = true;
      intent.tri = "note";
    }

    if (/\b(itineraire|itinéraire|trajet|parcours|road trip|week-?end|circuit)\b/.test(q)) {
      intent.itineraire = true;
    }

    for (const t of TYPES) {
      if (t.keys.some((k) => q.includes(norm(k)))) {
        intent.type = t.type;
        intent.typeLabel = t.label;
        break;
      }
    }

    for (const v of VILLES) {
      if (v.keys.some((k) => q.includes(k))) {
        intent.ville = v.nom;
        break;
      }
    }

    // Suites : "et à Bobo ?", "moins cher", "autre"
    if (!intent.type && ctx.lastType && /\b(autre|autres|encore|aussi|pareil|même|meme)\b/.test(q)) {
      intent.type = ctx.lastType;
      intent.typeLabel = (TYPES.find((t) => t.type === ctx.lastType) || {}).label;
      intent.followUp = true;
    }
    if (!intent.ville && ctx.lastVille && /\b(autre|autres|encore|là-bas|la-bas)\b/.test(q)) {
      intent.ville = ctx.lastVille;
      intent.followUp = true;
    }

    const mBudget =
      q.match(/(?:sous|moins de|max(?:imum)?|budget(?: max)?|jusqu[' ]a|jusqua|inferieur a|inférieur a)\s*(\d[\d\s.]*)/) ||
      q.match(/(\d[\d\s.]*)\s*(?:fcfa|f cfa|francs?)/);
    if (mBudget) {
      const n = parseInt(String(mBudget[1]).replace(/[\s.]/g, ""), 10);
      if (!isNaN(n) && n > 0) intent.budgetMax = n;
    }
    if (/\b(pas cher|bon marche|bon marché|economique|économique|low cost|abordable)\b/.test(q)) {
      if (!intent.budgetMax) {
        if (intent.type === "hotel") intent.budgetMax = 20000;
        else if (intent.type === "restaurant") intent.budgetMax = 6000;
        else if (intent.type === "fastfood") intent.budgetMax = 3500;
        else intent.budgetMax = 15000;
      }
      intent.tri = intent.tri || "budgetCroissant";
    }
    if (/\b(luxe|luxueux|premium|haut de gamme|cher)\b/.test(q)) {
      intent.budgetMin = intent.type === "hotel" ? 40000 : 10000;
      intent.tri = intent.tri || "budgetDecroissant";
    }

    const stop = new Set([
      "un", "une", "des", "le", "la", "les", "de", "du", "au", "aux", "a", "à",
      "pour", "avec", "dans", "sur", "moi", "mon", "ma", "mes", "je", "trouve", "cherche",
      "montre", "donne", "propose", "veux", "voudrais", "besoin", "ou", "où", "est", "sont",
      "fcfa", "franc", "francs", "budget", "max", "min", "sous", "moins", "pas", "cher",
      "meilleur", "meilleurs", "top", "pres", "proche", "autour", "itineraire", "trajet",
      "hotel", "hotels", "restaurant", "resto", "restos", "fast", "food", "station",
      "banque", "ecole", "telecom", "tourisme", "site", "sites", "s il", "sil", "plait", "plaît",
      "peux", "tu", "me", "svp", "stp",
    ]);
    const tokens = q
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stop.has(t));
    intent.motCle = tokens.slice(0, 3).join(" ");

    return intent;
  }

  function filtrerLieux(intent) {
    let list = Array.isArray(lieux) ? [...lieux] : [];

    if (intent.type) {
      list = list.filter((l) => l.type === intent.type);
    }
    if (intent.ville) {
      const v = intent.ville.toLowerCase();
      let filtered = list.filter((l) => {
        const lv = (l.ville || "").toLowerCase();
        return lv.includes(v.split("-")[0].slice(0, 6)) || lv.includes(v);
      });
      if (filtered.length === 0) {
        filtered = list.filter((l) => {
          const lv = (l.ville || "").toLowerCase();
          return intent.ville.split(/[\s-]/).some(
            (part) => part.length > 3 && lv.includes(part.toLowerCase().slice(0, 5)),
          );
        });
      }
      list = filtered;
    }
    if (intent.budgetMax != null) {
      list = list.filter((l) => l.budget == null || l.budget <= intent.budgetMax);
    }
    if (intent.budgetMin != null) {
      list = list.filter((l) => l.budget != null && l.budget >= intent.budgetMin);
    }
    if (intent.motCle && intent.motCle.length > 2) {
      const m = intent.motCle.toLowerCase();
      const byName = list.filter(
        (l) =>
          (l.nom || "").toLowerCase().includes(m) ||
          (l.ville || "").toLowerCase().includes(m),
      );
      if (byName.length) list = byName;
    }

    const tri =
      intent.tri ||
      (intent.nearMe ? "proximite" : intent.best ? "note" : "note");
    if (tri === "proximite" && positionUtilisateur) {
      list.sort(
        (a, b) =>
          distanceKm(positionUtilisateur.lat, positionUtilisateur.lng, a.coords[0], a.coords[1]) -
          distanceKm(positionUtilisateur.lat, positionUtilisateur.lng, b.coords[0], b.coords[1]),
      );
    } else if (tri === "budgetCroissant") {
      list.sort((a, b) => (a.budget ?? Infinity) - (b.budget ?? Infinity));
    } else if (tri === "budgetDecroissant") {
      list.sort((a, b) => (b.budget ?? -Infinity) - (a.budget ?? -Infinity));
    } else {
      list.sort(
        (a, b) =>
          getNoteLieu(b) - getNoteLieu(a) || getNbAvisLieu(b) - getNbAvisLieu(a),
      );
    }
    return list;
  }

  function applyToUI(intent, results) {
    try {
      filtresActifs.motCle = intent.ville
        ? intent.ville.toLowerCase()
        : intent.motCle || "";
      filtresActifs.type = intent.type;
      filtresActifs.budgetMin = intent.budgetMin || 0;
      filtresActifs.budgetMax =
        intent.budgetMax != null ? intent.budgetMax : Infinity;
      filtresActifs.tri = intent.tri || "note";

      if (inputSearch) inputSearch.value = filtresActifs.motCle;
      if (inputBudgetMin) inputBudgetMin.value = intent.budgetMin || "";
      if (inputBudgetMax)
        inputBudgetMax.value =
          intent.budgetMax != null ? intent.budgetMax : "";
      if (selectTri) selectTri.value = filtresActifs.tri;

      boutonsFiltreType.forEach((btn) => {
        btn.classList.toggle("actif", btn.dataset.type === intent.type);
      });

      if (typeof mettreAJourAffichage === "function") {
        mettreAJourAffichage(results.slice(0, 40), true);
      }
      if (typeof majClearSearchVisibility === "function") majClearSearchVisibility();
    } catch (err) {
      console.warn("[Nearix AI] applyToUI", err);
    }
  }

  function buildResultsHtml(results, intent) {
    if (!results.length) {
      return `<p>Aucun lieu trouvé pour cette demande. Essayez une autre ville, un budget plus large ou un type différent.</p>
        <div class="ai-actions">
          <button type="button" class="ai-act" data-ai-action="clear">Réinitialiser les filtres</button>
          <button type="button" class="ai-act" data-ai-action="geo">Activer ma position</button>
        </div>`;
    }

    const top = results.slice(0, 5);
    const items = top
      .map((l, i) => {
        const note = getNoteLieu(l).toFixed(1);
        const budget = formatBudget(l.budget);
        let dist = "";
        if (positionUtilisateur) {
          const d = distanceKm(
            positionUtilisateur.lat,
            positionUtilisateur.lng,
            l.coords[0],
            l.coords[1],
          );
          dist = ` · ${d < 10 ? d.toFixed(1) : Math.round(d)} km`;
        }
        return `<li data-ai-idx="${i}" title="Voir sur la carte">
          <span class="ai-li-name">${esc(l.nom)}</span>
          <span class="ai-li-meta">★${note} · ${budget}${dist}</span>
        </li>`;
      })
      .join("");

    const typeTxt = intent.typeLabel || "lieux";
    const villeTxt = intent.ville ? ` à <strong>${esc(intent.ville)}</strong>` : "";
    const budgetTxt =
      intent.budgetMax != null
        ? ` (budget ≤ <strong>${intent.budgetMax.toLocaleString("fr-FR")} FCFA</strong>)`
        : "";
    const total = results.length;
    const intro = `J'ai trouvé <strong>${total}</strong> ${typeTxt}${villeTxt}${budgetTxt}. Voici le top ${Math.min(5, total)} :`;

    const actions = [
      `<button type="button" class="ai-act primary" data-ai-action="show-all">Voir sur la carte</button>`,
      `<button type="button" class="ai-act" data-ai-action="add-top">➕ Ajouter le top 3 à l'itinéraire</button>`,
    ];
    if (intent.itineraire || total >= 2) {
      actions.push(
        `<button type="button" class="ai-act" data-ai-action="route">Calculer un trajet</button>`,
      );
    }

    return `<p>${intro}</p><ul class="ai-list">${items}</ul><div class="ai-actions">${actions.join("")}</div>`;
  }

  function proposeWeekend() {
    const pool = (type, villePart) =>
      (lieux || []).filter(
        (l) =>
          l.type === type &&
          (!villePart || (l.ville || "").toLowerCase().includes(villePart)),
      );
    const take = (arr, n) =>
      [...arr].sort((a, b) => getNoteLieu(b) - getNoteLieu(a)).slice(0, n);

    const cascade = pool("tourisme", "banfora").concat(
      (lieux || []).filter((l) =>
        /cascade|karfiguéla|fabédougou|loropéni/i.test(l.nom || ""),
      ),
    );
    const picks = [
      ...take(cascade.length ? cascade : pool("tourisme"), 2),
      ...take(pool("hotel", "banfora").length ? pool("hotel", "banfora") : pool("hotel", "ouaga"), 1),
      ...take(pool("restaurant", "ouaga"), 1),
    ];
    const seen = new Set();
    const unique = [];
    for (const p of picks) {
      if (!seen.has(p.nom)) {
        seen.add(p.nom);
        unique.push(p);
      }
    }
    return unique.slice(0, 5);
  }

  function respond(raw) {
    const intent = parseIntent(raw);
    ctx.turn += 1;

    // Conversation / FAQ
    if (intent.chat) {
      const html = replyFaq(intent.chat);
      return { html, results: [], intent };
    }

    if (intent.help) {
      return { html: replyFaq("help"), results: [], intent };
    }

    if (intent.clear) {
      filtresActifs.motCle = "";
      filtresActifs.type = null;
      filtresActifs.budgetMin = 0;
      filtresActifs.budgetMax = Infinity;
      filtresActifs.tri = "proximite";
      if (inputSearch) inputSearch.value = "";
      if (inputBudgetMin) inputBudgetMin.value = "";
      if (inputBudgetMax) inputBudgetMax.value = "";
      boutonsFiltreType.forEach((b) => b.classList.remove("actif"));
      if (typeof appliquerFiltres === "function") appliquerFiltres();
      return {
        html: `<p>Filtres réinitialisés. Tous les lieux sont à nouveau visibles sur la carte.</p>`,
        results: lieux || [],
        intent,
      };
    }

    if (intent.itineraire && !intent.type && !intent.ville) {
      const week = proposeWeekend();
      ctx.lastResults = week;
      applyToUI(
        { type: null, ville: null, budgetMax: null, budgetMin: null, tri: "note", motCle: "" },
        week,
      );
      const html =
        `<p>Voici une idée de <strong>week-end au Burkina</strong> (tourisme + hôtel + resto) :</p>` +
        buildResultsHtml(week, {
          typeLabel: "étapes",
          ville: null,
          budgetMax: null,
          itineraire: true,
        }).replace(/^<p>.*?<\/p>/, "");
      return { html, results: week, intent };
    }

    if (intent.nearMe && !positionUtilisateur) {
      return {
        html: `<p>Pour trier par proximité, j'ai besoin de votre position.</p>
          <div class="ai-actions">
            <button type="button" class="ai-act primary" data-ai-action="geo">Activer ma position</button>
          </div>`,
        results: [],
        intent,
      };
    }

    // Recherche de lieux
    const hasSearch =
      intent.type ||
      intent.ville ||
      (intent.motCle && intent.motCle.length > 2) ||
      intent.budgetMax != null ||
      intent.nearMe ||
      intent.best;

    if (!hasSearch) {
      // Petite discussion générique
      return {
        html: `<p>Je n'ai pas bien saisi. Vous pouvez :</p>
          <ul class="ai-list" style="pointer-events:none">
            <li><span class="ai-li-name">Chercher un lieu</span> <span class="ai-li-meta">« restos Bobo »</span></li>
            <li><span class="ai-li-name">Poser une question</span> <span class="ai-li-meta">« climat », « cuisine »</span></li>
            <li><span class="ai-li-name">Demander de l'aide</span> <span class="ai-li-meta">« aide »</span></li>
          </ul>`,
        results: [],
        intent,
      };
    }

    const results = filtrerLieux(intent);
    ctx.lastResults = results;
    ctx.lastIntent = intent;
    if (intent.ville) ctx.lastVille = intent.ville;
    if (intent.type) ctx.lastType = intent.type;
    applyToUI(intent, results);

    return {
      html: buildResultsHtml(results, intent),
      results,
      intent,
    };
  }

  function handleAction(action) {
    if (action === "geo") {
      if (typeof utiliserMaPosition === "function") utiliserMaPosition(true);
      addMsg(
        `<p>Demande de géolocalisation envoyée… Autorisez l'accès dans le navigateur.</p>`,
        "bot",
      );
      return;
    }
    if (action === "clear") {
      const r = respond("vider les filtres");
      addMsg(r.html, "bot");
      return;
    }
    if (action === "show-all") {
      if (typeof activerOnglet === "function") activerOnglet("recherche");
      if (ctx.lastResults.length && typeof mettreAJourAffichage === "function") {
        mettreAJourAffichage(ctx.lastResults.slice(0, 40), true);
      }
      if (typeof showToast === "function")
        showToast("Résultats affichés sur la carte", "success");
      return;
    }
    if (action === "add-top") {
      const top = ctx.lastResults.slice(0, 3);
      top.forEach((l) => {
        const deja = itineraire.some(
          (e) => e.nom === l.nom && e.ville === l.ville,
        );
        if (!deja) itineraire.push(l);
      });
      if (typeof afficherItineraire === "function") afficherItineraire();
      if (typeof activerOnglet === "function") activerOnglet("itineraire");
      if (typeof showToast === "function")
        showToast(`${top.length} lieu(x) ajouté(s) à l'itinéraire`, "success");
      addMsg(
        `<p>Les <strong>${top.length}</strong> premiers lieux ont été ajoutés. Ouvrez l'onglet <strong>Itinéraire</strong> pour calculer le trajet.</p>`,
        "bot",
      );
      return;
    }
    if (action === "route") {
      if (!ctx.lastResults.length) return;
      ctx.lastResults.slice(0, 4).forEach((l) => {
        const deja = itineraire.some(
          (e) => e.nom === l.nom && e.ville === l.ville,
        );
        if (!deja) itineraire.push(l);
      });
      if (typeof afficherItineraire === "function") afficherItineraire();
      if (typeof activerOnglet === "function") activerOnglet("itineraire");
      setTimeout(() => {
        if (typeof calculerItineraire === "function") calculerItineraire();
      }, 300);
      addMsg(
        `<p>Itinéraire en cours de calcul avec les lieux sélectionnés…</p>`,
        "bot",
      );
    }
  }

  function bindMsgActions(msg) {
    msg.querySelectorAll(".ai-list li[data-ai-idx]").forEach((li) => {
      li.addEventListener("click", () => {
        const idx = parseInt(li.dataset.aiIdx, 10);
        const lieu = ctx.lastResults[idx];
        if (!lieu || !mapReady()) return;
        try {
          map.setView(lieu.coords, 16);
          const m = markers.find((mk) => {
            try {
              const ll = mk.getLatLng();
              return (
                Math.abs(ll.lat - lieu.coords[0]) < 1e-5 &&
                Math.abs(ll.lng - lieu.coords[1]) < 1e-5
              );
            } catch (_) {
              return false;
            }
          });
          if (m) m.openPopup();
          if (typeof showToast === "function") showToast(lieu.nom, "info");
          if (
            typeof isMobileLayout === "function" &&
            isMobileLayout() &&
            typeof setPanelOpen === "function"
          ) {
            setPanelOpen(false);
          }
        } catch (err) {
          console.warn("[Nearix AI] focus lieu", err);
        }
      });
    });
    msg.querySelectorAll("[data-ai-action]").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(btn.dataset.aiAction));
    });
  }

  function onSubmit(text) {
    const t = String(text || "").trim();
    if (!t) return;
    addMsg(esc(t), "user");
    inputEl.value = "";
    const typing = showTyping();
    setTimeout(() => {
      try {
        typing.remove();
      } catch (_) {}
      try {
        const { html } = respond(t);
        const msg = addMsg(html, "bot");
        bindMsgActions(msg);
      } catch (err) {
        console.error("[Nearix AI]", err);
        addMsg(
          `<p>Oups, petite erreur de mon côté. Reformulez simplement — ex. « hotels Ouaga » ou « aide ».</p>`,
          "bot",
        );
      }
    }, 280 + Math.random() * 200);
  }

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    onSubmit(inputEl.value);
  });

  suggestionsEl?.querySelectorAll(".ai-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.q || chip.textContent;
      if (typeof activerOnglet === "function") activerOnglet("assistant");
      onSubmit(q);
    });
  });

  // Bienvenue à la première ouverture de l'onglet
  if (typeof tabs !== "undefined" && tabs) {
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.dataset.tab === "assistant" && !welcomeShown) {
          welcomeShown = true;
          addMsg(
            `<p>Bonjour ! Je suis l'<strong>assistant Nearix</strong> ✨</p>
             <p>Je cherche des lieux au Burkina, je propose des itinéraires, et je peux aussi parler <strong>culture, cuisine, climat, transport</strong>…</p>
             <p style="margin-top:6px;font-size:0.8rem;color:var(--text-muted)">Essayez une suggestion ou écrivez librement.</p>`,
            "bot",
          );
        }
      });
    });
  }
})();
