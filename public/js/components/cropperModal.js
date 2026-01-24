/**
 * CropperModal
 * -------------
 * Utilitaire de recadrage d'image sans dépendance Bootstrap.
 * Utilise CropperJS et un modal custom isolé.
 *
 * Événements émis :
 * - onCropperCreation : quand CropperJS est initialisé
 * - onCropperDone     : quand l'image est recadrée et validée
 *
 * Dépendances :
 * - CropperJS (https://fengyuanchen.github.io/cropperjs/)
 *
 * Exemple d'utilisation :
 * ```js
 * const input = document.getElementById("avatarInput");
 * const cropper = new CropperModal(input);
 *
 * document.addEventListener("onCropperDone", (e) => {
 *   console.log(e.detail.base64);
 * });
 * ```
 */
export class CropperModal {
    /**
     * @param {HTMLInputElement} fileInput Input file utilisé pour charger l'image
     */
    constructor(fileInput) {
        this.fileInput = fileInput;
        this.croppedImage = null;

        this.createCropper();
        this.bindElements();
        this.handleCropper();
    }

    /**
     * Injecte le HTML du modal de recadrage dans le DOM
     * @private
     */
    createCropper() {
        document.body.insertAdjacentHTML(
            "beforeend",
            `
            <div class="cropper-overlay" id="cropperOverlay">
                <div class="cropper-modal">
                    <div class="cropper-header">
                        <h3>Recadrer la photo de profil</h3>
                        <button class="cropper-close" id="cropperClose">✕</button>
                    </div>

                    <div class="cropper-body">
                        <img id="imageToCrop" alt="Image à recadrer" />
                    </div>

                    <div class="cropper-footer">
                        <button class="cropper-btn cancel" id="cropCancel">Annuler</button>
                        <button class="cropper-btn confirm" id="cropAccept">Accepter</button>
                    </div>
                </div>
            </div>

            `
        );
    }

    /**
     * Récupère les éléments DOM du modal et bind les événements
     * @private
     */
    bindElements() {
        this.overlay = document.getElementById("cropperOverlay");
        this.imageToCrop = document.getElementById("imageToCrop");
        this.closeBtn = document.getElementById("cropperClose");
        this.cancelBtn = document.getElementById("cropCancel");
        this.acceptBtn = document.getElementById("cropAccept");

        this.closeBtn.onclick = () => this.close();
        this.cancelBtn.onclick = () => this.close();
    }

    /**
     * Ouvre le modal
     */
    open() {
        this.overlay.classList.add("active");
    }

    /**
     * Ferme le modal et détruit l'instance CropperJS
     */
    close() {
        this.overlay.classList.remove("active");

        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    }

    /**
     * Gère la sélection de fichier et l'initialisation du cropper
     * @private
     */
    handleCropper() {
        this.fileInput.addEventListener("change", (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.imageToCrop.src = e.target.result;
                this.open();

                this.cropper = new Cropper(this.imageToCrop, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 1,
                });

                document.dispatchEvent(
                    new CustomEvent("onCropperCreation", {
                        detail: { cropper: this.cropper },
                    })
                );
            };

            reader.readAsDataURL(file);
        });

        this.acceptBtn.addEventListener("click", () => {
            if (!this.cropper) return;

            const canvas = this.cropper.getCroppedCanvas({
                width: 300,
                height: 300,
                imageSmoothingQuality: "high",
            });

            this.croppedImage = canvas.toDataURL("image/png");

            /**
             * 🔔 Événement déclenché quand l'image est prête
             */
            document.dispatchEvent(
                new CustomEvent("onCropperDone", {
                    detail: {
                        base64: this.croppedImage,
                        canvas,
                        cropper: this.cropper,
                    },
                })
            );

            this.close();
        });
    }

    /**
     * Retourne l'image recadrée en base64
     * @returns {string|null}
     */
    getCroppedImage() {
        return this.croppedImage;
    }
}
