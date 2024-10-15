let cropper; // Variable pour le cropper
const cropModal = new bootstrap.Modal(document.getElementById('cropModal'));
const dropContainer = document.getElementById("dropcontainer");
const fileInput = document.getElementById("profilePicture");

dropContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
}, false);

dropContainer.addEventListener("dragenter", () => {
  dropContainer.classList.add("drag-active");
});

dropContainer.addEventListener("dragleave", () => {
  dropContainer.classList.remove("drag-active");
});

dropContainer.addEventListener("drop", (e) => {
  e.preventDefault();
  dropContainer.classList.remove("drag-active");
  fileInput.files = e.dataTransfer.files;
  fileInput.dispatchEvent(new Event('change'));
});
fileInput.addEventListener('change', function(event) {
  const file = event.target.files[0];
  const imageToCrop = document.getElementById('imageToCrop');

  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      imageToCrop.src = e.target.result;

      // Ouvrir la modale de recadrage
      cropModal.show();

      // Créer un cropper pour l'image
      if (cropper) {
        cropper.destroy(); // Détruire l'ancien cropper si existant
      }
      cropper = new Cropper(imageToCrop, {
        aspectRatio: 1, // Ratio pour un carré
        viewMode: 1,
        autoCropArea: 1,
        minContainerWidth: 600,
        minContainerHeight: 600,
      });
    };

    reader.readAsDataURL(file); // Charger l'image
  }
});

// Gérer le bouton Accepter dans la modale
document.getElementById('cropAccept').addEventListener('click', function() {
  // Récupérer l'image recadrée
  const canvas = cropper.getCroppedCanvas({
    width: 300,
    height: 300,
    imageSmoothingEnabled: false, // Évite la perte de détails avec la transparence
    imageSmoothingQuality: 'high'
  });

  // Convertir l'image en base64
  const croppedImage = canvas.toDataURL('image/png');
  // Ajouter l'image recadrée au formulaire
  // (Vous pouvez également l'envoyer à une balise img pour la prévisualisation)
  const imagePreviewBox = document.getElementById('dropcontainer')
  imagePreviewBox.style.backgroundImage = `url('${croppedImage}')`
  // Fermer la modale
  cropModal.hide();
});

document.getElementById('registerForm').addEventListener('submit', function(e) {
  e.preventDefault();

  let formData = new FormData();
  username = document.getElementById('username').value;
  password = document.getElementById('password').value;
  let croppedImage;
  // Récupérer l'image recadrée si elle existe
  if (cropper) {
    const canvas = cropper.getCroppedCanvas({
      width: 300,
      height: 300,
    });
    croppedImage = canvas.toDataURL('image/png');
  }

  // Envoyer les données au serveur via axios
  axios.post('/register', {username: username, password: password, profileImage: croppedImage})
    .then(response => {
      console.log(response.data.success);
      if(response.data.success){
        console.log('Inscription réussie !', response.data);
        localStorage.setItem('username', username);
        window.location.href = "../../index.html"
      }else{
        console.error('Erreur lors de l\'inscription :', response.data);
      }
    })
    .catch(error => {
      console.error('Erreur lors de l\'inscription :', error);
    });
});
