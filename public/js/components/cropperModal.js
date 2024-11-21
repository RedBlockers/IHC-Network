export class CropperModal {
  constructor(fileInput) {
      this.fileInput = fileInput;
      this.createCropper()
      this.cropModal = new bootstrap.Modal(document.getElementById('cropModal'));
      this.handleCropper()
  }

  createCropper() {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="cropModal" tabindex="-1" aria-labelledby="cropModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered">
              <div class="modal-content bg-dark text-white">
                <div class="modal-header">
                  <h5 class="modal-title" id="cropModalLabel">Recadrer la photo de profil</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body d-flex justify-content-center">
                  <img id="imageToCrop" class="img-fluid" style="max-width: 100%;" />
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                  <button type="button" class="btn btn-primary" id="cropAccept">Accepter</button>
                </div>
              </div>
            </div>
          </div>
      `);
  }

  handleCropper() {
    this.fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      const imageToCrop = document.getElementById('imageToCrop');

      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imageToCrop.src = e.target.result;

          // Ouvrir la modale de recadrage
          this.cropModal.show();

          // Créer un cropper pour l'image
          if (this.cropper) {
            this.cropper.destroy();
          }
          this.cropper = new Cropper(imageToCrop, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            minContainerWidth: 600,
            minContainerHeight: 600,
          });
        };

        reader.readAsDataURL(file); // Charger l'image
      }
    });

    document.getElementById('cropAccept').addEventListener('click', () => {
      // Récupérer l'image recadrée
      if (this.cropper) {
        const canvas = this.cropper.getCroppedCanvas({
          width: 300,
          height: 300,
          imageSmoothingEnabled: false,
          imageSmoothingQuality: 'high',
        });

        // Convertir l'image en base64
        const croppedImage = canvas.toDataURL('image/png');

        // Ajouter l'image recadrée au formulaire (ou à une balise img)
        const imagePreviewBox = document.getElementById('dropcontainer');
        if (imagePreviewBox) {
          imagePreviewBox.style.backgroundImage = `url('${croppedImage}')`;
        }

        // Fermer la modale
        this.cropModal.hide();
      }
    });
  }
}