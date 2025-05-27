document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

	// Clear any previous error message
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if(!email || !password){
            errorMessage.textContent = "Please fill in all fields";
            return;
        }

		// Validate email format
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
        fetch('api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        })
        .then(response => {
			if (!response.ok) {
        return response.text().then(text => {
            // Try to parse as JSON and throw the whole JSON string
            try {
                const json = JSON.parse(text);
                throw new Error(JSON.stringify(json));
            } catch {
                throw new Error(text);
            }
        });
    }
		return response.json();
		})
		// Handle the response
		.then(data => {
			loginButton.textContent = originalButtonText;
			loginButton.disabled = false;

			if(data.status === "success"){
				let user = data.data[0];
				localStorage.setItem('apikey', user.apikey);
				localStorage.setItem('name', user.name);
				localStorage.setItem('surname', user.surname);
				localStorage.setItem('user_type', user.user_type);

				errorMessage.textContent = "Login successful!";
				errorMessage.style.color = "green";

				// Redirect after a short delay
				setTimeout(() => {
					if (user.user_type === 'Manager') {
						window.location.href = "manager.html";
					} else {
						window.location.href = "index.html";
					}
				}, 1000);
			} else {
				// Show API-provided error message (lockout, attempts left, etc.)
				errorMessage.textContent = data.data || "Login failed. Please try again.";
				errorMessage.style.color = "red";
			}
		})
		.catch(error => {
			loginButton.textContent = originalButtonText;
			loginButton.disabled = false;

			let msg = "An error occurred during login. Please try again.";

			// Try to extract the 'data' property from a JSON error message
			try {
				// If error.message looks like a JSON string, parse it
				if (error.message.trim().startsWith('{')) {
					const json = JSON.parse(error.message);
					if (json && json.data) {
						msg = json.data;
					}
				} else if (error.message) {
					// If the API error message is just the data string, use it
					msg = error.message;
				}
			} catch (e) {
				// Ignore parsing errors, fallback to generic message
			}

			// Show error details if available
			errorMessage.textContent = msg;
			errorMessage.style.color = "red";
			console.error('Login error:', error);
		});
    });
});