const rotateElements = document.getElementsByClassName('rotate-return');
Array.from(rotateElements).forEach(rotateElement => {
  rotateElement.addEventListener('mouseover', () => {
    rotateElement.classList.add('rotate');
  });
  rotateElement.addEventListener('animationend', () => {
    rotateElement.classList.remove('rotate');
  });
})