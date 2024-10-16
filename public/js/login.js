// login.js
document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Empêche le rechargement de la page

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    axios.post('/login', {username: username, password: password})
    .then(response => {
      if(response.data.success){
        console.log('Inscription réussie !', response.data);
        localStorage.setItem('token', response.data.token);
        window.location.href = "../../index.html"
      }else{
        console.error('Erreur lors de l\'inscription :', response.data);
      }
    })
    .catch(error => {
      console.error('Erreur lors de l\'inscription :', error);
    });
});
