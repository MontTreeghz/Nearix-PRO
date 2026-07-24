// --- Sélection des éléments HTML ---
const inputVille = document.querySelector("#recherche input");
const boutonRecherche = document.querySelector("#btnRecherche");
const boutonRestaurants = document.querySelector("#btnRestaurants");
const boutonHotels = document.querySelector("#btnHotels");
const boutonFastfoods = document.querySelector("#btnFastfoods");
const listeResultats = document.querySelector("#resultats ul");

// --- Données fictives avec coordonnées ---
const lieux = [
  // --- Hôtels Ouagadougou ---
  {
    type: "hotel",
    nom: "Bravia Hotel Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.3656, -1.5126],
  },
  {
    type: "hotel",
    nom: "Sopatel Silmandé",
    ville: "Ouagadougou",
    coords: [12.392, -1.531],
  },
  {
    type: "hotel",
    nom: "Sonia Hotel",
    ville: "Ouagadougou",
    coords: [12.3605, -1.5102],
  },
  {
    type: "hotel",
    nom: "Hotel Kavana",
    ville: "Ouagadougou",
    coords: [12.3689, -1.512],
  },
  {
    type: "hotel",
    nom: "Villa Yiri Suma",
    ville: "Ouagadougou",
    coords: [12.3642, -1.5148],
  },
  {
    type: "hotel",
    nom: "Pacific Hotel",
    ville: "Ouagadougou",
    coords: [12.369, -1.518],
  },
  {
    type: "hotel",
    nom: "Palm Beach Hotel",
    ville: "Ouagadougou",
    coords: [12.368, -1.517],
  },
  {
    type: "hotel",
    nom: "Azalaï Hôtel Ouagadougou",
    ville: "Ouagadougou",
    coords: [12.356, -1.512],
  },
  {
    type: "hotel",
    nom: "Lancaster Ouaga 2000",
    ville: "Ouagadougou",
    coords: [12.31, -1.48],
  },

  // --- Restaurants Ouagadougou ---
  {
    type: "restaurant",
    nom: "Le Verdoyant",
    ville: "Ouagadougou",
    coords: [12.365, -1.515],
  },
  {
    type: "restaurant",
    nom: "La Perle",
    ville: "Ouagadougou",
    coords: [12.366, -1.516],
  },
  {
    type: "restaurant",
    nom: "Le Gondwana",
    ville: "Ouagadougou",
    coords: [12.367, -1.517],
  },
  {
    type: "restaurant",
    nom: "La Dolce Vita",
    ville: "Ouagadougou",
    coords: [12.369, -1.519],
  },
  {
    type: "restaurant",
    nom: "Le Nomade",
    ville: "Ouagadougou",
    coords: [12.37, -1.52],
  },
  {
    type: "restaurant",
    nom: "Le Petit Bruxelles",
    ville: "Ouagadougou",
    coords: [12.371, -1.521],
  },
  {
    type: "restaurant",
    nom: "Festival des Saveurs",
    ville: "Ouagadougou",
    coords: [12.375, -1.525],
  },
  {
    type: "restaurant",
    nom: "Savane Grill",
    ville: "Ouagadougou",
    coords: [12.38, -1.53],
  },
  {
    type: "restaurant",
    nom: "Le Pavé",
    ville: "Ouagadougou",
    coords: [12.382, -1.532],
  },
  {
    type: "restaurant",
    nom: "Yiri Suma",
    ville: "Ouagadougou",
    coords: [12.384, -1.534],
  },

  // --- Fast-foods Ouagadougou ---
  {
    type: "fastfood",
    nom: "KFC Ouaga",
    ville: "Ouagadougou",
    coords: [12.365, -1.514],
  },
  {
    type: "fastfood",
    nom: "Burger King Ouaga",
    ville: "Ouagadougou",
    coords: [12.366, -1.515],
  },
  {
    type: "fastfood",
    nom: "Pizza Hut Ouaga",
    ville: "Ouagadougou",
    coords: [12.367, -1.516],
  },
  {
    type: "fastfood",
    nom: "Chicken Express",
    ville: "Ouagadougou",
    coords: [12.368, -1.517],
  },
  {
    type: "fastfood",
    nom: "Ouaga Burger",
    ville: "Ouagadougou",
    coords: [12.37, -1.519],
  },
  {
    type: "fastfood",
    nom: "Tacos Faso",
    ville: "Ouagadougou",
    coords: [12.374, -1.523],
  },
  {
    type: "fastfood",
    nom: "Snack Mogho",
    ville: "Ouagadougou",
    coords: [12.382, -1.531],
  },
  {
    type: "fastfood",
    nom: "Ouaga Tacos",
    ville: "Ouagadougou",
    coords: [12.384, -1.533],
  },

  // --- Exemple hors Ouaga ---
  {
    type: "hotel",
    nom: "Hotel Faso",
    ville: "Bobo-Dioulasso",
    coords: [11.1771, -4.2979],
  },
  {
    type: "restaurant",
    nom: "Chez Mamadou",
    ville: "Bobo-Dioulasso",
    coords: [11.177, -4.297],
  },
];

// --- Fonction pour afficher des résultats ---
function afficherResultats(resultats) {
  listeResultats.innerHTML = "";
  if (resultats.length === 0) {
    listeResultats.innerHTML = "<li>Aucun résultat trouvé</li>";
  } else {
    resultats.forEach((lieu) => {
      const li = document.createElement("li");
      li.textContent = `${lieu.type.toUpperCase()} : ${lieu.nom} - ${lieu.ville}`;
      listeResultats.appendChild(li);
    });
  }
}

// --- Initialiser la carte ---
const map = L.map("map").setView([12.3714, -1.5197], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// --- Fonction pour afficher les marqueurs ---
let markers = [];
function afficherMarqueurs(resultats) {
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  resultats.forEach((lieu) => {
    const marker = L.marker(lieu.coords)
      .addTo(map)
      .bindPopup(`<b>${lieu.nom}</b><br>${lieu.type} - ${lieu.ville}`);
    markers.push(marker);
  });

  if (resultats.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds());
  }
}

// --- Fonction de recherche par nom, ville ou type ---
function rechercherLieu() {
  const recherche = inputVille.value.toLowerCase().trim();
  const resultats = lieux.filter(
    (lieu) =>
      lieu.nom.toLowerCase().includes(recherche) ||
      lieu.ville.toLowerCase().includes(recherche) ||
      lieu.type.toLowerCase().includes(recherche),
  );
  afficherResultats(resultats);
  afficherMarqueurs(resultats);
}

// --- Fonction de filtrage par type ---
function filtrerParType(type) {
  const resultats = lieux.filter((lieu) => lieu.type === type);
  afficherResultats(resultats);
  afficherMarqueurs(resultats);
}

// --- Événements ---
inputVille.addEventListener("input", rechercherLieu);
boutonRecherche.addEventListener("click", rechercherLieu);
boutonRestaurants.addEventListener("click", () => filtrerParType("restaurant"));
boutonHotels.addEventListener("click", () => filtrerParType("hotel"));
boutonFastfoods.addEventListener("click", () => filtrerParType("fastfood"));

// --- Afficher tous les lieux au départ ---
afficherResultats(lieux);
afficherMarqueurs(lieux);
