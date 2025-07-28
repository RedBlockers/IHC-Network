(function () {
    const isMobile = window.innerWidth <= 768;
    const body = document.body;
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const toggleButton = document.querySelector(".sidebar-toggle");

    if (isMobile) {
        body.classList.add("mobile-mode");
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener("touchstart", (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener("touchend", (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });

        function handleSwipe() {
            const swipeDistance = touchEndX - touchStartX;
            if (swipeDistance > 100) {
                sidebar.classList.add("open");
                mainContent.classList.add("hide-on-mobile");
            } else if (swipeDistance < -100) {
                sidebar.classList.remove("open");
                mainContent.classList.remove("hide-on-mobile");
            }
        }

        if (toggleButton) {
            toggleButton.addEventListener("click", () => {
                sidebar.classList.toggle("open");
                mainContent.classList.toggle("hide-on-mobile");
            });
        }
    }
})();
