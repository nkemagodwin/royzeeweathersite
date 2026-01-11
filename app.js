// Configuration
const CONFIG = {
    API_KEY: 'YOUR_OPENWEATHERMAP_API_KEY', // Get yours from https://openweathermap.org/api
    BASE_URL: 'https://api.openweathermap.org/data/2.5',
    GEOCODING_URL: 'https://api.openweathermap.org/geo/1.0',
    UNITS: 'metric', // 'metric' for Celsius, 'imperial' for Fahrenheit
    DEFAULT_CITY: 'New York'
};

// State management
let currentUnit = localStorage.getItem('weatherUnit') || CONFIG.UNITS;
let currentLocation = {
    lat: null,
    lon: null,
    city: CONFIG.DEFAULT_CITY,
    country: 'US'
};

// DOM Elements
const elements = {
    loading: document.getElementById('loading'),
    errorMessage: document.getElementById('error-message'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    useLocationBtn: document.getElementById('use-location'),
    unitButtons: document.querySelectorAll('.unit-btn'),
    refreshBtn: document.getElementById('refresh-data'),
    apiStatus: document.getElementById('api-status')
};

// Weather icons mapping
const WEATHER_ICONS = {
    '01d': 'fa-sun',
    '01n': 'fa-moon',
    '02d': 'fa-cloud-sun',
    '02n': 'fa-cloud-moon',
    '03d': 'fa-cloud',
    '03n': 'fa-cloud',
    '04d': 'fa-cloud',
    '04n': 'fa-cloud',
    '09d': 'fa-cloud-rain',
    '09n': 'fa-cloud-rain',
    '10d': 'fa-cloud-sun-rain',
    '10n': 'fa-cloud-moon-rain',
    '11d': 'fa-bolt',
    '11n': 'fa-bolt',
    '13d': 'fa-snowflake',
    '13n': 'fa-snowflake',
    '50d': 'fa-smog',
    '50n': 'fa-smog'
};

// Popular cities for quick access
const POPULAR_CITIES = [
    { name: 'London', country: 'UK' },
    { name: 'Tokyo', country: 'Japan' },
    { name: 'Sydney', country: 'Australia' },
    { name: 'Paris', country: 'France' },
    { name: 'Dubai', country: 'UAE' },
    { name: 'Singapore', country: 'Singapore' },
    { name: 'Mumbai', country: 'India' },
    { name: 'Beijing', country: 'China' }
];

// Initialize the application
async function init() {
    console.log('Initializing weather app...');
    
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check API status
    await checkAPIStatus();
    
    // Try to get user's location first
    if (navigator.geolocation) {
        getUserLocation();
    } else {
        // If geolocation not available, load default city
        loadWeatherData(CONFIG.DEFAULT_CITY);
    }
    
    // Load popular cities
    loadPopularCities();
    
    // Load weather maps
    loadWeatherMaps();
    
    // Load weather news
    loadWeatherNews();
    
    // Update date
    updateDate();
    setInterval(updateDate, 60000);
}

// Set up all event listeners
function setupEventListeners() {
    // Search functionality
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Location button
    elements.useLocationBtn.addEventListener('click', getUserLocation);
    
    // Unit toggle buttons
    elements.unitButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const unit = this.getAttribute('data-unit');
            changeTemperatureUnit(unit);
        });
    });
    
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        loadWeatherData(currentLocation.city);
    });
    
    // Navigation
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
            
            // If maps page is opened, refresh maps
            if (pageId === 'maps') {
                loadWeatherMaps();
            }
        });
    });
    
    // Mobile menu toggle
    document.querySelector('.mobile-menu-btn').addEventListener('click', function() {
        document.querySelector('nav ul').classList.toggle('show');
    });
    
    // Theme toggle
    document.querySelector('.theme-toggle').addEventListener('click', function() {
        const body = document.body;
        if (body.style.background.includes('dark')) {
            body.style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
        } else {
            body.style.background = 'linear-gradient(135deg, #0a0e2d, #1a3b5d)';
        }
    });
}

// Get user's current location
function getUserLocation() {
    showLoading();
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                currentLocation.lat = position.coords.latitude;
                currentLocation.lon = position.coords.longitude;
                
                // Get city name from coordinates
                const response = await fetch(
                    `${CONFIG.GEOCODING_URL}/reverse?lat=${currentLocation.lat}&lon=${currentLocation.lon}&limit=1&appid=${CONFIG.API_KEY}`
                );
                
                if (!response.ok) throw new Error('Geocoding failed');
                
                const data = await response.json();
                if (data && data[0]) {
                    currentLocation.city = data[0].name;
                    currentLocation.country = data[0].country;
                    
                    // Load weather for current location
                    await loadWeatherData(currentLocation.city);
                }
            } catch (error) {
                console.error('Error getting location:', error);
                showError('Unable to get your location. Showing default city.');
                loadWeatherData(CONFIG.DEFAULT_CITY);
            } finally {
                hideLoading();
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
            showError('Location access denied. Using default city.');
            loadWeatherData(CONFIG.DEFAULT_CITY);
            hideLoading();
        }
    );
}

// Handle search for a city
async function handleSearch() {
    const searchTerm = elements.searchInput.value.trim();
    if (!searchTerm) return;
    
    showLoading();
    try {
        await loadWeatherData(searchTerm);
    } catch (error) {
        console.error('Search error:', error);
        showError('City not found. Please try again.');
    } finally {
        hideLoading();
    }
}

// Load weather data for a specific city
async function loadWeatherData(city) {
    showLoading();
    
    try {
        // Get coordinates for the city
        const geocodeResponse = await fetch(
            `${CONFIG.GEOCODING_URL}/direct?q=${encodeURIComponent(city)}&limit=1&appid=${CONFIG.API_KEY}`
        );
        
        if (!geocodeResponse.ok) throw new Error('Geocoding failed');
        
        const geocodeData = await geocodeResponse.json();
        if (!geocodeData || geocodeData.length === 0) {
            throw new Error('City not found');
        }
        
        // Update current location
        currentLocation.lat = geocodeData[0].lat;
        currentLocation.lon = geocodeData[0].lon;
        currentLocation.city = geocodeData[0].name;
        currentLocation.country = geocodeData[0].country;
        
        // Get current weather
        const weatherResponse = await fetch(
            `${CONFIG.BASE_URL}/weather?lat=${currentLocation.lat}&lon=${currentLocation.lon}&units=${currentUnit}&appid=${CONFIG.API_KEY}`
        );
        
        if (!weatherResponse.ok) throw new Error('Weather data failed');
        
        const weatherData = await weatherResponse.json();
        
        // Get 5-day forecast
        const forecastResponse = await fetch(
            `${CONFIG.BASE_URL}/forecast?lat=${currentLocation.lat}&lon=${currentLocation.lon}&units=${currentUnit}&appid=${CONFIG.API_KEY}`
        );
        
        if (!forecastResponse.ok) throw new Error('Forecast data failed');
        
        const forecastData = await forecastResponse.json();
        
        // Update UI with data
        updateCurrentWeather(weatherData);
        update5DayForecast(forecastData);
        updateHourlyForecast(forecastData);
        update7DayForecast(forecastData);
        
        // Update search input
        elements.searchInput.value = '';
        
        // Hide any error messages
        hideError();
        
    } catch (error) {
        console.error('Error loading weather data:', error);
        showError(error.message || 'Failed to load weather data. Please try again.');
    } finally {
        hideLoading();
    }
}

// Update current weather display
function updateCurrentWeather(data) {
    // Update city name
    document.getElementById('current-city').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('forecast-city').textContent = `${data.name}, ${data.sys.country}`;
    
    // Update temperature
    const tempElement = document.querySelector('.temperature');
    tempElement.textContent = `${Math.round(data.main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}`;
    
    // Update feels like
    const feelsLikeElement = document.querySelector('.feels-like');
    feelsLikeElement.textContent = `Feels like: ${Math.round(data.main.feels_like)}°${currentUnit === 'metric' ? 'C' : 'F'}`;
    
    // Update condition
    const conditionElement = document.querySelector('.condition');
    conditionElement.textContent = data.weather[0].description;
    
    // Update weather icon
    const iconElement = document.querySelector('.weather-icon i');
    const iconClass = WEATHER_ICONS[data.weather[0].icon] || 'fa-question';
    iconElement.className = `fas ${iconClass}`;
    
    // Update weather details
    const windSpeed = currentUnit === 'metric' ? `${data.wind.speed} km/h` : `${data.wind.speed} mph`;
    const visibility = currentUnit === 'metric' ? `${(data.visibility / 1000).toFixed(1)} km` : `${(data.visibility / 1609).toFixed(1)} miles`;
    
    document.querySelectorAll('.detail-card p')[0].textContent = windSpeed;
    document.querySelectorAll('.detail-card p')[1].textContent = `${data.main.humidity}%`;
    document.querySelectorAll('.detail-card p')[2].textContent = visibility;
    document.querySelectorAll('.detail-card p')[3].textContent = `${data.main.pressure} hPa`;
    
    // Convert sunrise/sunset times
    const sunriseTime = new Date(data.sys.sunrise * 1000);
    const sunsetTime = new Date(data.sys.sunset * 1000);
    
    document.querySelectorAll('.detail-card p')[4].textContent = 
        sunriseTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('.detail-card p')[5].textContent = 
        sunsetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update 5-day forecast
function update5DayForecast(data) {
    const forecastContainer = document.getElementById('5-day-forecast');
    forecastContainer.innerHTML = '';
    
    // Get unique days (skip today)
    const dailyForecasts = {};
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        
        if (day !== today && Object.keys(dailyForecasts).length < 5) {
            if (!dailyForecasts[day]) {
                dailyForecasts[day] = {
                    temp_min: item.main.temp_min,
                    temp_max: item.main.temp_max,
                    icon: item.weather[0].icon,
                    description: item.weather[0].description
                };
            } else {
                dailyForecasts[day].temp_min = Math.min(dailyForecasts[day].temp_min, item.main.temp_min);
                dailyForecasts[day].temp_max = Math.max(dailyForecasts[day].temp_max, item.main.temp_max);
            }
        }
    });
    
    // Create forecast cards
    Object.entries(dailyForecasts).forEach(([day, forecast]) => {
        const card = document.createElement('div');
        card.className = 'forecast-card';
        
        const iconClass = WEATHER_ICONS[forecast.icon] || 'fa-question';
        
        card.innerHTML = `
            <div class="forecast-day">${day}</div>
            <div class="forecast-icon"><i class="fas ${iconClass}"></i></div>
            <div class="forecast-temp">
                <span class="max-temp">${Math.round(forecast.temp_max)}°${currentUnit === 'metric' ? 'C' : 'F'}</span>
                <span class="min-temp">${Math.round(forecast.temp_min)}°${currentUnit === 'metric' ? 'C' : 'F'}</span>
            </div>
        `;
        
        forecastContainer.appendChild(card);
    });
}

// Update hourly forecast
function updateHourlyForecast(data) {
    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = '';
    
    // Get next 24 hours of forecast (3-hour intervals)
    const next24Hours = data.list.slice(0, 8);
    
    next24Hours.forEach(item => {
        const time = new Date(item.dt * 1000);
        const hour = time.getHours();
        const displayTime = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
        
        const iconClass = WEATHER_ICONS[item.weather[0].icon] || 'fa-question';
        
        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <div class="hourly-time">${displayTime}</div>
            <div class="hourly-icon"><i class="fas ${iconClass}"></i></div>
            <div class="hourly-temp">${Math.round(item.main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}</div>
        `;
        
        hourlyContainer.appendChild(card);
    });
}

// Update 7-day forecast
function update7DayForecast(data) {
    const forecastContainer = document.getElementById('7-day-forecast');
    forecastContainer.innerHTML = '';
    
    // For 7-day forecast, we need a different API endpoint
    // This is a simplified version using available data
    const dailyForecasts = {};
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        if (!dailyForecasts[day] || dailyForecasts[day].length < 3) {
            if (!dailyForecasts[day]) {
                dailyForecasts[day] = [];
            }
            dailyForecasts[day].push(item);
        }
    });
    
    // Create forecast cards for next 7 days
    Object.entries(dailyForecasts).slice(0, 7).forEach(([day, forecasts]) => {
        if (forecasts.length > 0) {
            const tempMin = Math.min(...forecasts.map(f => f.main.temp_min));
            const tempMax = Math.max(...forecasts.map(f => f.main.temp_max));
            const avgHumidity = Math.round(forecasts.reduce((sum, f) => sum + f.main.humidity, 0) / forecasts.length);
            const avgWind = Math.round(forecasts.reduce((sum, f) => sum + f.wind.speed, 0) / forecasts.length);
            
            const iconClass = WEATHER_ICONS[forecasts[0].weather[0].icon] || 'fa-question';
            
            const card = document.createElement('div');
            card.className = 'forecast-card';
            card.innerHTML = `
                <div class="forecast-day">${day}</div>
                <div class="forecast-icon"><i class="fas ${iconClass}"></i></div>
                <div class="forecast-temp">
                    <span class="max-temp">${Math.round(tempMax)}°${currentUnit === 'metric' ? 'C' : 'F'}</span>
                    <span class="min-temp">${Math.round(tempMin)}°${currentUnit === 'metric' ? 'C' : 'F'}</span>
                </div>
                <div class="forecast-details">
                    <p>Wind: ${avgWind} ${currentUnit === 'metric' ? 'km/h' : 'mph'}</p>
                    <p>Humidity: ${avgHumidity}%</p>
                </div>
            `;
            
            forecastContainer.appendChild(card);
        }
    });
}

// Load popular cities
async function loadPopularCities() {
    const citiesContainer = document.getElementById('popular-cities');
    citiesContainer.innerHTML = '';
    
    for (const city of POPULAR_CITIES) {
        try {
            const response = await fetch(
                `${CONFIG.BASE_URL}/weather?q=${encodeURIComponent(city.name)}&units=${currentUnit}&appid=${CONFIG.API_KEY}`
            );
            
            if (response.ok) {
                const data = await response.json();
                
                const card = document.createElement('div');
                card.className = 'city-card';
                card.setAttribute('data-city', city.name);
                
                const iconClass = WEATHER_ICONS[data.weather[0].icon] || 'fa-question';
                
                card.innerHTML = `
                    <div class="city-info">
                        <h4>${data.name}, ${data.sys.country}</h4>
                        <p>${data.weather[0].description}</p>
                    </div>
                    <div class="city-temp">
                        <i class="fas ${iconClass}"></i>
                        ${Math.round(data.main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}
                    </div>
                `;
                
                card.addEventListener('click', () => {
                    elements.searchInput.value = `${city.name}, ${city.country}`;
                    handleSearch();
                });
                
                citiesContainer.appendChild(card);
            }
        } catch (error) {
            console.error(`Error loading ${city.name}:`, error);
        }
    }
}

// Load weather maps
function loadWeatherMaps() {
    // These are example map URLs - in a real app, you'd use a mapping service
    // or embed weather map widgets
    
    const maps = {
        'temperature-map': 'https://openweathermap.org/weathermap?basemap=map&cities=true&layer=temperature&lat=0&lon=0&zoom=2',
        'rain-map': 'https://openweathermap.org/weathermap?basemap=map&cities=true&layer=precipitation&lat=0&lon=0&zoom=2',
        'wind-visualization': 'https://openweathermap.org/weathermap?basem
