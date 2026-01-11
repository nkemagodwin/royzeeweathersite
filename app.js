// Real-time Weather Application
class RealTimeWeatherApp {
    constructor() {
        this.API_KEY = WEATHER_API_KEY;
        this.currentUnit = 'metric';
        this.currentLocation = null;
        this.weatherData = null;
        this.forecastData = null;
        this.lastUpdate = null;
        this.updateInterval = 10 * 60 * 1000; // 10 minutes
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.offlineMode = false;
        this.cachedData = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkConnection();
        this.loadUserPreferences();
        this.startAutoUpdate();
        this.updateTime();
        
        // Try to get user's location
        this.getUserLocation();
        
        // Initialize charts
        this.initCharts();
        
        // Show initial loading
        this.showLoading();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Mobile menu
        document.querySelector('.mobile-menu-btn').addEventListener('click', () => {
            document.querySelector('nav ul').classList.toggle('show');
        });

        // Search
        document.getElementById('search-btn').addEventListener('click', () => this.handleSearch());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.handleSearchSuggestions(e.target.value);
        });

        // Current location button
        document.getElementById('current-location-btn').addEventListener('click', () => {
            this.getUserLocation(true);
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshWeatherData();
        });

        // Unit toggle
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleUnit(e));
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.retryConnection();
        });

        // Refresh map
        document.getElementById('refresh-map')?.addEventListener('click', () => {
            this.refreshMap();
        });

        // Map type buttons
        document.querySelectorAll('.map-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeMapType(e));
        });

        // Load more news
        document.getElementById('load-more-news')?.addEventListener('click', () => {
            this.loadMoreNews();
        });

        // Monitor online/offline status
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));

        // Visibility change (tab switch)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.refreshIfNeeded();
            }
        });
    }

    async getUserLocation(force = false) {
        if (!force && localStorage.getItem('lastLocation')) {
            const lastLocation = JSON.parse(localStorage.getItem('lastLocation'));
            this.currentLocation = lastLocation;
            await this.fetchWeatherData(lastLocation.lat, lastLocation.lon);
            return;
        }

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    this.currentLocation = { lat: latitude, lon: longitude };
                    localStorage.setItem('lastLocation', JSON.stringify(this.currentLocation));
                    await this.fetchWeatherData(latitude, longitude);
                },
                async (error) => {
                    console.warn('Geolocation error:', error);
                    // Fallback to IP-based location or default city
                    await this.fetchWeatherByIP();
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 600000 // 10 minutes
                }
            );
        } else {
            await this.fetchWeatherByIP();
        }
    }

    async fetchWeatherByIP() {
        try {
            // Fallback: Use IP-based location
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            this.currentLocation = { 
                lat: data.latitude, 
                lon: data.longitude,
                city: data.city,
                country: data.country_name
            };
            await this.fetchWeatherData(data.latitude, data.longitude);
        } catch (error) {
            console.error('IP location failed:', error);
            // Final fallback: Default city
            this.currentLocation = { lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US' };
            await this.fetchWeatherData(40.7128, -74.0060);
        }
    }

    async fetchWeatherData(lat, lon) {
        try {
            this.showLoading();
            
            // Fetch current weather
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${this.currentUnit}&appid=${this.API_KEY}`;
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${this.currentUnit}&appid=${this.API_KEY}`;
            
            const [weatherResponse, forecastResponse] = await Promise.all([
                fetch(weatherUrl),
                fetch(forecastUrl)
            ]);

            if (!weatherResponse.ok || !forecastResponse.ok) {
                throw new Error('API request failed');
            }

            const weatherData = await weatherResponse.json();
            const forecastData = await forecastResponse.json();

            this.weatherData = weatherData;
            this.forecastData = forecastData;
            this.lastUpdate = new Date();
            
            // Update UI
            this.updateCurrentWeather();
            this.updateForecast();
            this.updateHourlyForecast();
            this.updatePopularCities();
            
            // Save to cache
            this.cacheData(weatherData, forecastData);
            
            // Hide loading
            this.hideLoading();
            
            // Show success notification
            this.showNotification('Weather data updated successfully');
            
            // Reset retry attempts
            this.retryAttempts = 0;
            
        } catch (error) {
            console.error('Error fetching weather:', error);
            this.handleFetchError(error);
        }
    }

    async handleSearch() {
        const searchTerm = document.getElementById('search-input').value.trim();
        if (!searchTerm) return;

        try {
            // Geocode search term
            const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchTerm)}&limit=5&appid=${this.API_KEY}`;
            const response = await fetch(geocodeUrl);
            const data = await response.json();

            if (data.length > 0) {
                const { lat, lon, name, country } = data[0];
                this.currentLocation = { lat, lon, city: name, country };
                await this.fetchWeatherData(lat, lon);
            } else {
                this.showNotification('Location not found', 'error');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showNotification('Search failed. Please try again.', 'error');
        }
    }

    async handleSearchSuggestions(query) {
        if (query.length < 2) {
            document.getElementById('search-suggestions').innerHTML = '';
            document.getElementById('search-suggestions').style.display = 'none';
            return;
        }

        try {
            const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${this.API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            const suggestions = document.getElementById('search-suggestions');
            suggestions.innerHTML = '';
            
            data.forEach(city => {
                const div = document.createElement('div');
                div.className = 'search-suggestion';
                div.textContent = `${city.name}, ${city.country}`;
                div.addEventListener('click', () => {
                    document.getElementById('search-input').value = `${city.name}, ${city.country}`;
                    suggestions.style.display = 'none';
                    this.handleSearch();
                });
                suggestions.appendChild(div);
            });

            suggestions.style.display = data.length > 0 ? 'block' : 'none';
        } catch (error) {
            // Silently fail for suggestions
        }
    }

    updateCurrentWeather() {
        if (!this.weatherData) return;

        const data = this.weatherData;
        
        // Update location
        document.getElementById('current-city').textContent = `${data.name}, ${data.sys.country}`;
        document.getElementById('detailed-city').textContent = `${data.name}, ${data.sys.country}`;
        
        // Update temperature
        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        document.getElementById('current-temp').textContent = temp;
        document.getElementById('feels-like').textContent = feelsLike;
        document.getElementById('detailed-temp').textContent = temp;
        
        // Update condition
        const condition = data.weather[0].description;
        document.getElementById('current-condition').textContent = condition;
        document.getElementById('detailed-condition').textContent = condition;
        
        // Update icon
        const iconClass = this.getWeatherIcon(data.weather[0].id, data.weather[0].icon);
        document.getElementById('weather-icon').className = `fas ${iconClass}`;
        document.getElementById('detailed-icon').className = `fas ${iconClass}`;
        
        // Update details
        document.getElementById('wind-speed').textContent = `${Math.round(data.wind.speed)} ${this.currentUnit === 'metric' ? 'km/h' : 'mph'}`;
        document.getElementById('humidity').textContent = `${data.main.humidity}%`;
        document.getElementById('visibility').textContent = `${(data.visibility / 1000).toFixed(1)} km`;
        document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
        
        // Update wind direction
        if (data.wind.deg) {
            const direction = this.getWindDirection(data.wind.deg);
            const arrow = document.querySelector('#wind-direction i');
            arrow.style.transform = `rotate(${data.wind.deg}deg)`;
        }
        
        // Update humidity bar
        const humidityFill = document.getElementById('humidity-fill');
        humidityFill.style.width = `${data.main.humidity}%`;
        
        // Update UV index (mock - OpenWeatherMap doesn't provide UV in free tier)
        const uvIndex = Math.floor(Math.random() * 11); // 0-10
        document.getElementById('uv-index').textContent = uvIndex;
        const uvFill = document.getElementById('uv-fill');
        uvFill.style.width = `${(uvIndex / 10) * 100}%`;
        
        // Update last updated time
        this.updateLastUpdated();
    }

    updateForecast() {
        if (!this.forecastData) return;

        const container = document.getElementById('forecast-container');
        container.innerHTML = '';

        // Group forecasts by day
        const dailyForecasts = {};
        this.forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const day = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            if (!dailyForecasts[day] || dailyForecasts[day].length < 8) {
                if (!dailyForecasts[day]) dailyForecasts[day] = [];
                dailyForecasts[day].push(item);
            }
        });

        // Get next 5 days
        const days = Object.keys(dailyForecasts).slice(0, 5);

        days.forEach(day => {
            const dayForecasts = dailyForecasts[day];
            const maxTemp = Math.max(...dayForecasts.map(f => f.main.temp_max));
            const minTemp = Math.min(...dayForecasts.map(f => f.main.temp_min));
            const mainCondition = dayForecasts[Math.floor(dayForecasts.length / 2)].weather[0];

            const card = document.createElement('div');
            card.className = 'forecast-card';
            card.innerHTML = `
                <div class="forecast-day">${day}</div>
                <div class="forecast-icon">
                    <i class="fas ${this.getWeatherIcon(mainCondition.id, mainCondition.icon)}"></i>
                </div>
                <div class="forecast-temp">
                    <span class="max-temp">${Math.round(maxTemp)}°</span>
                    <span class="min-temp">${Math.round(minTemp)}°</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    updateHourlyForecast() {
        if (!this.forecastData) return;

        const container = document.getElementById('hourly-container');
        container.innerHTML = '';

        // Get next 24 hours (3-hour intervals)
        const hourly = this.forecastData.list.slice(0, 8);

        hourly.forEach(hour => {
            const date = new Date(hour.dt * 1000);
            const time = date.toLocaleTimeString('en-US', { 
                hour: 'numeric',
                hour12: true 
            }).replace(' ', '');
            
            const card = document.createElement('div');
            card.className = 'hourly-card';
            card.innerHTML = `
                <div class="hourly-time">${time}</div>
                <div class="hourly-icon">
                    <i class="fas ${this.getWeatherIcon(hour.weather[0].id, hour.weather[0].icon)}"></i>
                </div>
                <div class="hourly-temp">${Math.round(hour.main.temp)}°</div>
                <div class="hourly-precipitation" style="font-size: 0.8rem; margin-top: 5px;">
                    ${hour.pop ? `${Math.round(hour.pop * 100)}%` : '0%'}
                </div>
            `;
            container.appendChild(card);
        });
    }

    async updatePopularCities() {
        const cities = [
            { name: 'London', country: 'GB' },
            { name: 'Tokyo', country: 'JP' },
            { name: 'Sydney', country: 'AU' },
            { name: 'Paris', country: 'FR' },
            { name: 'Dubai', country: 'AE' },
            { name: 'New York', country: 'US' }
        ];

        const container = document.getElementById('cities-container');
        container.innerHTML = '';

        for (const city of cities) {
            try {
                const url = `https://api.openweathermap.org/data/2.5/weather?q=${city.name},${city.country}&units=${this.currentUnit}&appid=${this.API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();

                const card = document.createElement('div');
                card.className = 'city-card';
                card.setAttribute('data-city', city.name);
                card.innerHTML = `
                    <div class="city-info">
                        <h4>${data.name}, ${data.sys.country}</h4>
                        <p>${data.weather[0].description}</p>
                    </div>
                    <div class="city-temp">${Math.round(data.main.temp)}°</div>
                `;

                card.addEventListener('click', () => {
                    document.getElementById('search-input').value = `${city.name}, ${city.country}`;
                    this.handleSearch();
                });

                container.appendChild(card);
            } catch (error) {
                console.error(`Error fetching ${city.name}:`, error);
            }
        }
    }

    getWeatherIcon(conditionCode, iconCode) {
        const iconMap = {
            // Clear
            800: iconCode.includes('n') ? 'fa-moon' : 'fa-sun',
            // Clouds
            801: 'fa-cloud-sun',
            802: 'fa-cloud',
            803: 'fa-cloud',
            804: 'fa-cloud',
            // Rain
            500: 'fa-cloud-rain',
            501: 'fa-cloud-rain',
            502: 'fa-cloud-showers-heavy',
            503: 'fa-cloud-showers-heavy',
            504: 'fa-cloud-showers-heavy',
            // Drizzle
            300: 'fa-cloud-rain',
            301: 'fa-cloud-rain',
            302: 'fa-cloud-rain',
            // Thunderstorm
            200: 'fa-bolt',
            201: 'fa-bolt',
            202: 'fa-bolt',
            // Snow
            600: 'fa-snowflake',
            601: 'fa-snowflake',
            602: 'fa-snowflake',
            // Atmosphere
            701: 'fa-smog',
            711: 'fa-smog',
            721: 'fa-smog',
            731: 'fa-smog',
            741: 'fa-smog',
            751: 'fa-smog',
            761: 'fa-smog',
            762: 'fa-smog',
            771: 'fa-wind',
            781: 'fa-tornado'
        };

        return iconMap[conditionCode] || 'fa-cloud';
    }

    getWindDirection(degrees) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round((degrees % 360) / 45) % 8;
        return directions[index];
    }

    updateTime() {
        const now = new Date();
        
        // Update date
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', dateOptions);
        
        document.querySelectorAll('#current-date, #detailed-date').forEach(el => {
            el.textContent = dateStr;
        });
        
        // Update time
        const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
        const timeStr = now.toLocaleTimeString('en-US', timeOptions);
        
        document.querySelectorAll('#current-time, #detailed-time').forEach(el => {
            el.textContent = timeStr;
        });
        
        // Update page refresh time
        document.getElementById('page-refresh-time').textContent = timeStr;
        
        // Schedule next update
        setTimeout(() => this.updateTime(), 60000); // Update every minute
    }

    updateLastUpdated() {
        if (!this.lastUpdate) return;
        
        const now = new Date();
        const diff = Math.floor((now - this.lastUpdate) / 1000); // in seconds
        
        let text;
        if (diff < 60) {
            text = 'Just now';
        } else if (diff < 3600) {
            const minutes = Math.floor(diff / 60);
            text = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        } else {
            const hours = Math.floor(diff / 3600);
            text = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        }
        
        document.querySelectorAll('#update-time, #forecast-update, #map-updated-time, #news-updated-time').forEach(el => {
            el.textContent = text;
        });
    }

    startAutoUpdate() {
        setInterval(() => {
            if (document.visibilityState === 'visible' && !this.offlineMode) {
                this.refreshWeatherData();
            }
        }, this.updateInterval);
    }

    async refreshWeatherData() {
        if (!this.currentLocation) return;
        
        const btn = document.getElementById('refresh-btn');
        btn.classList.add('rotating');
        
        await this.fetchWeatherData(this.currentLocation.lat, this.currentLocation.lon);
        
        setTimeout(() => {
            btn.classList.remove('rotating');
        }, 1000);
    }

    refreshIfNeeded() {
        if (!this.lastUpdate) return;
        
        const now = new Date();
        const diff = now - this.lastUpdate;
        
        if (diff > this.updateInterval) {
            this.refreshWeatherData();
        }
    }

    toggleUnit(e) {
        const unit = e.target.dataset.unit;
        if (this.currentUnit === unit) return;
        
        this.currentUnit = unit;
        
        // Update UI
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === unit);
        });
        
        // Update temp unit display
        document.querySelectorAll('.temp-unit').forEach(el => {
            el.textContent = unit === 'metric' ? '°C' : '°F';
        });
        
        // Refresh data with new unit
        if (this.currentLocation) {
            this.fetchWeatherData(this.currentLocation.lat, this.currentLocation.lon);
        }
        
        // Save preference
        localStorage.setItem('preferredUnit', unit);
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const icon = document.querySelector('#theme-toggle i');
        const isDark = document.body.classList.contains('dark-theme');
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        
        // Save preference
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    checkConnection() {
        const isOnline = navigator.onLine;
        this.handleConnectionChange(isOnline);
    }

    handleConnectionChange(isOnline) {
        const status = document.getElementById('connection-status');
        const indicator = status.querySelector('i');
        
        if (isOnline) {
            status.classList.remove('offline');
            indicator.style.color = '#4CAF50';
            status.innerHTML = '<i class="fas fa-circle"></i> Online';
            this.offlineMode = false;
            
            // Try to refresh if we were offline
            if (this.offlineMode) {
                this.refreshWeatherData();
            }
        } else {
            status.classList.add('offline');
            indicator.style.color = '#ff4444';
            status.innerHTML = '<i class="fas fa-circle"></i> Offline';
            this.offlineMode = true;
            this.showNotification('You are offline. Using cached data.', 'warning');
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('error-message').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showError(message) {
        document.getElementById('error-text').textContent = message;
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('loading').style.display = 'none';
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notification-text');
        
        text.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    handleFetchError(error) {
        console.error('Fetch error:', error);
        this.retryAttempts++;
        
        if (this.retryAttempts <= this.maxRetries) {
            // Try again after delay
            setTimeout(() => {
                if (this.currentLocation) {
                    this.fetchWeatherData(this.currentLocation.lat, this.currentLocation.lon);
                }
            }, 2000 * this.retryAttempts);
        } else {
            // Use cached data if available
            if (this.cachedData) {
                this.useCachedData();
                this.showNotification('Using cached data. Connection issues.', 'warning');
            } else {
                this.showError('Unable to load weather data. Please check your connection.');
            }
        }
    }

    retryConnection() {
        document.getElementById('error-message').style.display = 'none';
        if (this.currentLocation) {
            this.fetchWeatherData(this.currentLocation.lat, this.currentLocation.lon);
        }
    }

    cacheData(weather, forecast) {
        this.cachedData = {
            weather,
            forecast,
            timestamp: new Date().getTime()
        };
        
        try {
            localStorage.setItem('weatherCache', JSON.stringify(this.cachedData));
        } catch (e) {
            console.warn('LocalStorage is full or not available');
        }
    }

    useCachedData() {
        try {
            const cached = JSON.parse(localStorage.getItem('weatherCache'));
            if (cached && cached.weather) {
                this.weatherData = cached.weather;
                this.forecastData = cached.forecast;
                this.updateCurrentWeather();
                this.updateForecast();
                this.updateHourlyForecast();
                this.hideLoading();
            }
        } catch (e) {
            console.error('Error loading cached data:', e);
        }
    }

    loadUserPreferences() {
        // Load theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            document.querySelector('#theme-toggle i').className = 'fas fa-sun';
        }
        
        // Load unit
        const savedUnit = localStorage.getItem('preferredUnit');
        if (savedUnit) {
            this.currentUnit = savedUnit;
            document.querySelectorAll('.unit-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.unit === savedUnit);
            });
            document.querySelectorAll('.temp-unit').forEach(el => {
                el.textContent = savedUnit === 'metric' ? '°C' : '°F';
            });
        }
        
        // Load cached data if offline
        if (!navigator.onLine) {
            this.useCachedData();
        }
    }

    handleNavigation(e) {
        e.preventDefault();
        const pageId = e.target.getAttribute('data-page');
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(nav => {
            nav.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // Show selected page
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');
        
        // Close mobile menu if open
        document.querySelector('nav ul').classList.remove('show');
        
        // Handle specific page loads
        if (pageId === 'maps') {
            this.loadWeatherMap();
        } else if (pageId === 'news') {
            this.loadWeatherNews();
        }
    }

    loadWeatherMap() {
        // Implement map loading using Leaflet
        const mapContainer = document.getElementById('weather-map');
        if (!mapContainer || window.weatherMap) return;
        
        // Initialize map
        window.weatherMap = L.map('weather-map').setView([20, 0], 2);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(window.weatherMap);
        
        // Add weather layer (this would use a weather tile service in production)
        this.addWeatherLayer();
    }

    addWeatherLayer() {
        // This would connect to a weather tile service
        // For demo purposes, we'll show a placeholder
        const mapType = document.querySelector('.map-type-btn.active')?.dataset.mapType || 'temperature';
        
        // Update legend based on map type
        this.updateMapLegend(mapType);
    }

    updateMapLegend(mapType) {
        const legend = document.getElementById('map-legend');
        if (!legend) return;
        
        const legends = {
            temperature: 'Temperature (°C)',
            precipitation: 'Precipitation (mm)',
            wind: 'Wind Speed (km/h)',
            clouds: 'Cloud Cover (%)'
        };
        
        legend.textContent = legends[mapType] || 'Weather Data';
    }

    changeMapType(e) {
        document.querySelectorAll('.map-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        this.addWeatherLayer();
    }

    refreshMap() {
        if (window.weatherMap) {
            window.weatherMap.remove();
            window.weatherMap = null;
        }
        this.loadWeatherMap();
    }

    async loadWeatherNews() {
        // This would fetch real weather news from an API
        // For demo, we'll use mock data
        const newsContainer = document.getElementById('news-container');
        
        // Simulate loading
        const news = [
            {
                title: 'Real-time Storm Tracking Now Available',
                excerpt: 'New radar technology provides minute-by-minute storm updates.',
                date: new Date().toLocaleDateString(),
                icon: 'fa-satellite'
            },
            // Add more news items...
        ];
        
        newsContainer.innerHTML = news.map(item => `
            <div class="news-card">
                <div class="news-image">
                    <i class="fas ${item.icon}"></i>
                </div>
                <div class="news-content">
                    <div class="news-date">${item.date}</div>
                    <h3 class="news-title">${item.title}</h3>
                    <p class="news-excerpt">${item.excerpt}</p>
                </div>
            </div>
        `).join('');
    }

    loadMoreNews() {
        // Implement pagination for news
    }

    initCharts() {
        // Initialize Chart.js instances
        this.tempChart = new Chart(
            document.getElementById('temperature-chart').getContext('2d'),
            {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Temperature',
                        data: [],
                        borderColor: 'var(--accent)',
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    }
                }
            }
        );
        
        // Similar for precipitation chart
    }

    updateCharts() {
        if (!this.forecastData) return;
        
        // Update temperature chart
        const hourlyData = this.forecastData.list.slice(0, 8);
        const labels = hourlyData.map(h => 
            new Date(h.dt * 1000).toLocaleTimeString([], { hour: 'numeric', hour12: true })
        );
        const temps = hourlyData.map(h => h.main.temp);
        
        this.tempChart.data.labels = labels;
        this.tempChart.data.datasets[0].data = temps;
        this.tempChart.update();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.weatherApp = new RealTimeWeatherApp();
});

// Update current year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Update app version date
document.getElementById('app-version-date').textContent = new Date().toLocaleDateString();
