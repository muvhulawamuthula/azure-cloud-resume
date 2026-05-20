const visitorCountElement = document.getElementById("visitor-count");

async function getVisitorCount() {
  try {
    const response = await fetch("/api/visitorCounter");

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();

    visitorCountElement.textContent = data.count;
  } catch (error) {
    console.error("Error fetching visitor count:", error);
    visitorCountElement.textContent = "Unavailable";
  }
}

getVisitorCount();

const sections = document.querySelectorAll(".section, .project-card");

sections.forEach((section) => {
  section.classList.add("reveal");
});

function revealOnScroll() {
  const triggerBottom = window.innerHeight * 0.85;

  sections.forEach((section) => {
    const sectionTop = section.getBoundingClientRect().top;

    if (sectionTop < triggerBottom) {
      section.classList.add("active");
    }
  });
}

window.addEventListener("scroll", revealOnScroll);
revealOnScroll();