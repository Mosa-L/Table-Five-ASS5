document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if(!email || !password){
            errorMessage.textContent = "Please fill in all fields";
            return;
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if(!emailRegex.test(email)){
            errorMessage.textContent = "Please enter a valid email address";
            return;
        }
        
        const loginData = {
            type: "Login",
            email: email,
            password: password
        };
        
        // Show loading state
        const loginButton = document.getElementById('loginButton');
        const originalButtonText = loginButton.textContent;
        loginButton.textContent = "Logging in...";
        loginButton.disabled = true;
        
        // Send login request to API
        fetch('/COS221/Assignment%205/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        })
        .then(response => {
			// Check if the response is OK before trying to parse JSON
			if (!response.ok) {
				return response.text().then(text => {
					throw new Error(`Server error: ${response.status}. Details: ${text.substring(0, 100)}...`);
				});
			}
			return response.json();
		})
        .then(data => {

            loginButton.textContent = originalButtonText;
            loginButton.disabled = false;
            
            if(data.status === "success"){
                localStorage.setItem('user', JSON.stringify(data.data[0]));
                
                errorMessage.textContent = "Login successful!";
                errorMessage.style.color = "green";
                
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1000);
            }else{

                errorMessage.textContent = data.data || "Login failed. Please try again.";
                errorMessage.style.color = "red";
            }
        })
        .catch(error => {
            loginButton.textContent = originalButtonText;
            loginButton.disabled = false;
            
            errorMessage.textContent = "An error occurred during login. Please try again.";
            console.error('Login error:', error);
        });
    });
});