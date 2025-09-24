  // Update current date
        function updateDate() {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
            document.getElementById('forecast-date').textContent = now.toLocaleDateString('en-US', options);
        }

        // Navigation functionality
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const pageId = this.getAttribute('data-page');
                
                // Update active nav link
                document.querySelectorAll('.nav-link').forEach(nav => {
                    nav.classList.remove('active');
                });
                this.classList.add('active');
                
                // Show selected page
                document.querySelectorAll('.page').forEach(page => {
                    page.classList.remove('active');
                });
                document.getElementById(pageId).classList.add('active');
                
                // Close mobile menu if open
                document.querySelector('nav ul').classList.remove('show');
            });
        });

        // Mobile menu toggle
        document.querySelector('.mobile-menu-btn').addEventListener('click', function() {
            document.querySelector('nav ul').classList.toggle('show');
        });

        // Search functionality
        document.getElementById('search-btn').addEventListener('click', function() {
            const searchTerm = document.getElementById('search-input').value.trim();
            if (searchTerm) {
                // In a real app, this would fetch data from a weather API
                document.getElementById('current-city').textContent = searchTerm;
                document.getElementById('forecast-city').textContent = searchTerm;
                // Simulate weather data change
                simulateWeatherChange(searchTerm);
            }
        });

        // Allow Enter key to trigger search
        document.getElementById('search-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('search-btn').click();
            }
        });

        // Popular cities click functionality
        document.querySelectorAll('.city-card').forEach(card => {
            card.addEventListener('click', function() {
                const city = this.getAttribute('data-city');
                document.getElementById('current-city').textContent = city;
                document.getElementById('forecast-city').textContent = city;
                document.getElementById('search-input').value = city;
                simulateWeatherChange(city);
            });
        });

        // Theme toggle functionality
        document.querySelector('.theme-toggle').addEventListener('click', function() {
            const body = document.body;
            if (body.style.background.includes('dark')) {
                body.style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
            } else {
                body.style.background = 'linear-gradient(135deg, #0a0e2d, #1a3b5d)';
            }
        });

        // Simulate weather data change (in a real app, this would be API data)
        function simulateWeatherChange(city) {
            // Simple temperature variations based on city
            const tempVariations = {
                'New York': { temp: 24, condition: 'Partly Cloudy', icon: 'cloud-sun' },
                'London': { temp: 16, condition: 'Cloudy', icon: 'cloud' },
                'Tokyo': { temp: 28, condition: 'Sunny', icon: 'sun' },
                'Sydney': { temp: 22, condition: 'Clear', icon: 'sun' },
                'Paris': { temp: 14, condition: 'Rainy', icon: 'cloud-rain' }
            };
            
            const weather = tempVariations[city] || { temp: 20, condition: 'Clear', icon: 'sun' };
            
            // Update current weather
            document.querySelector('.temperature').textContent = `${weather.temp}°C`;
            document.querySelector('.condition').textContent = weather.condition;
            document.querySelector('.weather-icon i').className = `fas fa-${weather.icon}`;
            
            // Update weather details with some random values
            document.querySelectorAll('.detail-card p')[0].textContent = `${Math.floor(Math.random() * 20) + 5} km/h`;
            document.querySelectorAll('.detail-card p')[1].textContent = `${Math.floor(Math.random() * 40) + 40}%`;
            document.querySelectorAll('.detail-card p')[2].textContent = `${weather.temp + Math.floor(Math.random() * 4) - 2}°C`;
            document.querySelectorAll('.detail-card p')[3].textContent = `${Math.floor(Math.random() * 30) + 1000} hPa`;
            
            // Update forecast with some variations
            const forecastCards = document.querySelectorAll('.forecast-card');
            forecastCards.forEach(card => {
                const maxTemp = weather.temp + Math.floor(Math.random() * 6) - 3;
                const minTemp = maxTemp - Math.floor(Math.random() * 5) - 3;
                card.querySelector('.max-temp').textContent = `${maxTemp}°C`;
                card.querySelector('.min-temp').textContent = `${minTemp}°C`;
            });
        }

        // Initialize the page
        updateDate();
        
        // Update time every minute
        setInterval(updateDate, 60000);
        document.getElementById('currentYear').textContent = new Date().getFullYear();