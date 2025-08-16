// This script handles the automatic scrolling for skills and projects.

document.addEventListener('DOMContentLoaded', () => {
    const scrollers = document.querySelectorAll(".scroller");

    // If a user hasn't opted in for reduced motion, add the animation
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        addAnimation();
    }

    function addAnimation() {
        scrollers.forEach((scroller) => {
            // Make the scroller clickable on mobile
            scroller.setAttribute("tabindex", 0);

            const scrollerInner = scroller.querySelector(".scroller__inner");
            const scrollerContent = Array.from(scrollerInner.children);

            // For each item in the scroller, clone it and add it to the end
            scrollerContent.forEach((item) => {
                const duplicatedItem = item.cloneNode(true);
                // This is for accessibility, to hide the duplicated content from screen readers
                duplicatedItem.setAttribute("aria-hidden", true);
                scrollerInner.appendChild(duplicatedItem);
            });
        });
    }
});
