// Main script for scrollers and mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
    // ===== SCROLLERS FOR SKILLS & PROJECTS =====
    const scrollers = document.querySelectorAll(".scroller");

    // Only add animation if user hasn't opted for reduced motion
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        scrollers.forEach((scroller) => {
            // Make the scroller clickable on mobile
            scroller.setAttribute("tabindex", 0);

            const scrollerInner = scroller.querySelector(".scroller__inner");
            const scrollerContent = Array.from(scrollerInner.children);

            // Clone each item and append it for continuous scrolling
            scrollerContent.forEach((item) => {
                const duplicatedItem = item.cloneNode(true);
                duplicatedItem.setAttribute("aria-hidden", true);
                scrollerInner.appendChild(duplicatedItem);
            });
        });
    }

    // ===== MOBILE MENU TOGGLE =====
    const btn = document.getElementById("mobile-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu) {
        btn.addEventListener("click", () => {
            const isHidden = menu.classList.toggle("hidden");
            btn.setAttribute("aria-expanded", (!isHidden).toString());
        });
    }

    // ===== BACK TO TOP BUTTON =====
    const backToTop = document.getElementById('back-to-top');
    if (backToTop) {
        const toggleBackToTop = () => {
            if (window.scrollY > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        };

        window.addEventListener('scroll', toggleBackToTop, { passive: true });
        toggleBackToTop();

        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
