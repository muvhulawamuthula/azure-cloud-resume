const visitorCountElement = document.getElementById("visitor-count");

function updateLocalVisitorCounter() {
  let count = localStorage.getItem("portfolioVisitorCount");

  if (!count) {
    count = 1;
  } else {
    count = Number(count) + 1;
  }

  localStorage.setItem("portfolioVisitorCount", count);
  visitorCountElement.textContent = count;
}

updateLocalVisitorCounter();

const typingText = document.getElementById("typing-text");

const phrases = [
  "high-performance Java backend systems.",
  "cloud-native APIs on Azure.",
  "AI-powered RAG pipelines.",
  "JVM performance engineering tools.",
  "portfolio projects beyond CRUD."
];

let phraseIndex = 0;
let characterIndex = 0;
let isDeleting = false;

function typeEffect() {
  const currentPhrase = phrases[phraseIndex];

  if (isDeleting) {
    typingText.textContent = currentPhrase.substring(0, characterIndex--);
  } else {
    typingText.textContent = currentPhrase.substring(0, characterIndex++);
  }

  if (!isDeleting && characterIndex === currentPhrase.length + 1) {
    isDeleting = true;
    setTimeout(typeEffect, 1300);
    return;
  }

  if (isDeleting && characterIndex === 0) {
    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
  }

  const speed = isDeleting ? 35 : 65;
  setTimeout(typeEffect, speed);
}

typeEffect();

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