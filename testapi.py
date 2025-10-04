import requests
import numpy as np
from astropy.coordinates import get_body_barycentric_posvel, EarthLocation, AltAz
from astropy.time import Time
from astropy import units as u
from scipy.stats import multivariate_normal
from sklearn.neighbors import KernelDensity
import matplotlib.pyplot as plt
import plotly.graph_objects as go
from plotly.subplots import make_subplots
# cartopy is optional; plotting falls back to plain Matplotlib if not installed

# Step 1: Fetch NEO Data (NASA API)
def fetch_neo_data(neo_id, api_key):
    url = f"https://api.nasa.gov/neo/rest/v1/neo/{neo_id}?api_key={api_key}"
    print(url)
    try:
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            print(f"API Error {response.status_code}: {response.text}")
            raise ValueError(f"API error: {response.status_code} - {response.text}")
        
        data = response.json()
        print(data)
        print(f"API Response keys: {list(data.keys())}")
        
        # API returns data directly, not wrapped in 'neo' key
        neo_data = data
        print(f"NEO data keys: {list(neo_data.keys())}")
        
        # Extract orbital elements with error handling
        if 'orbital_data' not in neo_data:
            print("No orbital_data in NEO data")
            # Use default values if orbital elements not available
            orbital = {
                'semi_major_axis': 1.0,
                'eccentricity': 0.1,
                'inclination': 10.0,
                'epoch_osculation': 2451545.0
            }
        else:
            orbital = neo_data['orbital_data']
        
        a = orbital.get('semi_major_axis', 1.0)  # AU
        e = orbital.get('eccentricity', 0.1)
        i = orbital.get('inclination', 10.0)  # deg
        epoch_jd = orbital.get('epoch_osculation', 2451545.0)
        epoch = Time(epoch_jd, format='jd')
        
        # Proxy covariance: Gaussian noise on velocity (paper-inspired, 1% std)
        mean_posvel = get_body_barycentric_posvel('earth', epoch)  # Placeholder for NEO posvel
        cov_proxy = np.eye(6) * 0.01  # 6D: pos + vel, adjust based on data['is_potentially_hazardous']
        
        # For past impact validation (optional)
        actual_impact = fetch_past_impact(neo_id)  # From NEOFixer
        
        # Get diameter with error handling
        diameter = 1.0  # Default diameter
        if 'estimated_diameter' in neo_data and 'kilometers' in neo_data['estimated_diameter']:
            diameter = neo_data['estimated_diameter']['kilometers'].get('estimated_diameter_max', 1.0)
        
        return {
            'a': a, 'e': e, 'i': i, 'epoch': epoch,
            'diameter': diameter,
            'cov': cov_proxy,
            'actual_impact': actual_impact,  # dict with lat, lon if past
            'neo_id': neo_id  # Add neo_id for later use
        }
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

def fetch_past_impact(neo_id):
    # NEOFixer API (example, check docs for exact endpoint)
    try:
        url = f"https://neofixer.arizona.edu/api/impacts/{neo_id}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return {'lat': data['lat'], 'lon': data['lon'], 'time': data['time']}
    except Exception as e:
        print(f"Error fetching past impact data: {e}")
    return None

# Step 2: Sample Variants & Propagate (Astropy + Monte Carlo)
def sample_and_propagate(neo_data, num_samples=1000, years_forward=10):
    epoch = neo_data['epoch']
    cov = neo_data['cov']
    
    # Mean initial state (simplified Keplerian to posvel)
    mean_state = np.random.multivariate_normal(np.zeros(6), cov)  # Placeholder mean
    
    variants = []
    impacts = []
    times = np.linspace(epoch.jd, (epoch + years_forward * u.yr).jd, 365 * years_forward)
    
    for _ in range(num_samples):
        # Sample variant state
        state = np.random.multivariate_normal(mean_state, cov)
        pos = state[:3] * u.au  # Convert to AU
        vel = state[3:] * u.au / u.yr  # Velocity
        
        # Propagate (simple linear for demo; use astropy full integrator for real)
        trajectory = []  # List of (x,y,z) over time
        current_pos = pos
        for t in times[1:]:
            # Convert time difference to years and multiply by velocity
            dt_years = (t - times[0]) / 365.25
            # Convert velocity to AU/year and multiply by time to get displacement in AU
            displacement = vel * dt_years  # vel is in AU/yr, dt_years is dimensionless, result is AU
            # Both pos and displacement are now in AU, so we can add them directly
            current_pos = pos + displacement
            trajectory.append(current_pos.xyz.value)
            
            # Check Earth impact (distance < 1 AU + margin)
            earth_pos = get_body_barycentric_posvel('earth', Time(t, format='jd')).pos.xyz.value
            dist = np.linalg.norm(current_pos.xyz.value - earth_pos)
            if dist < 1.01:  # Earth radius ~1 AU scale
                # Compute lat/lon (simplified projection)
                lat, lon = np.random.uniform(-90,90), np.random.uniform(-180,180)  # Placeholder; use real coord transform
                impacts.append([lat, lon, 1.0 / num_samples])  # Prob = 1/N
        variants.append(np.array(trajectory))
    
    return np.array(variants), np.array(impacts), times

# Step 3: Compute Probabilities (KDE for density)
def compute_impact_probs(impacts):
    if len(impacts) == 0:
        # Return empty arrays with correct shape
        lon_grid, lat_grid = np.mgrid[-180:180:100j, -90:90:50j]
        probs = np.zeros_like(lon_grid)
        return probs, lon_grid, lat_grid
    
    # KDE on lat/lon grid (equirectangular)
    lon_grid, lat_grid = np.mgrid[-180:180:100j, -90:90:50j]
    points = impacts[:, :2]
    weights = impacts[:, 2]
    kde = KernelDensity(kernel='gaussian', bandwidth=5).fit(points, sample_weight=weights)
    log_probs = kde.score_samples(np.c_[lon_grid.ravel(), lat_grid.ravel()])
    probs = np.exp(log_probs).reshape(lon_grid.shape)
    
    # Normalize to [0,1] for coloring
    if probs.max() > probs.min():
        probs = (probs - probs.min()) / (probs.max() - probs.min())
    else:
        probs = np.zeros_like(probs)
    return probs, lon_grid, lat_grid

# Step 4: Visualizations
def plot_impact_map(probs, lon_grid, lat_grid, neo_data):
    fig = plt.figure(figsize=(12,6))
    ax = plt.gca()
    try:
        if 'ccrs' in globals() and ccrs is not None:
            ax = plt.axes(projection=ccrs.PlateCarree())
            ax.coastlines()
            ax.gridlines()
            im = ax.contourf(lon_grid, lat_grid, probs, levels=20, cmap='hot', transform=ccrs.PlateCarree())
            if neo_data['actual_impact']:
                ax.plot(neo_data['actual_impact']['lon'], neo_data['actual_impact']['lat'], 'bo', markersize=10, label='Actual Impact', transform=ccrs.PlateCarree())
        else:
            im = ax.contourf(lon_grid, lat_grid, probs, levels=20, cmap='hot')
            ax.set_xlim(-180, 180)
            ax.set_ylim(-90, 90)
            ax.set_xlabel('Longitude')
            ax.set_ylabel('Latitude')
            ax.grid(True)
            if neo_data['actual_impact']:
                ax.plot(neo_data['actual_impact']['lon'], neo_data['actual_impact']['lat'], 'bo', markersize=10, label='Actual Impact')
    except Exception:
        im = ax.contourf(lon_grid, lat_grid, probs, levels=20, cmap='hot')
        ax.set_xlim(-180, 180)
        ax.set_ylim(-90, 90)
        ax.set_xlabel('Longitude')
        ax.set_ylabel('Latitude')
        ax.grid(True)
        if neo_data['actual_impact']:
            ax.plot(neo_data['actual_impact']['lon'], neo_data['actual_impact']['lat'], 'bo', markersize=10, label='Actual Impact')

    plt.colorbar(im, label='Impact Probability (Normalized)')
    neo_id = neo_data.get('neo_id', 'Unknown')
    plt.title(f'Impact Map for NEO {neo_id}')
    plt.savefig('impact_map.png')
    plt.show()

def plot_uncertainty_tube(variants, times, neo_id):
    fig = go.Figure()
    
    # 3D tube: Plot bundle of trajectories (opacity fade over time)
    for i, traj in enumerate(variants[:50]):  # Sample 50 for vis
        x, y, z = traj.T  # Assume traj shape (time, 3)
        fig.add_trace(go.Scatter3d(x=x, y=y, z=z, mode='lines', opacity=0.3, line=dict(color='blue', width=1)))
    
    # Add Earth reference
    fig.add_trace(go.Surface(x=np.linspace(-1,1,20), y=np.linspace(-1,1,20), z=np.zeros((20,20)), opacity=0.1, colorscale='Earth'))
    
    fig.update_layout(title=f'Uncertainty Tube for NEO {neo_id}', scene=dict(xaxis_title='X (AU)', yaxis_title='Y (AU)', zaxis_title='Z (AU)'))
    fig.write_html('uncertainty_tube.html')  # Interactive 3D
    fig.show()

# Step 5: Validation (cho past impacts)
def validate_model(pred_impacts, actual):
    if actual and len(pred_impacts) > 0:
        pred_latlon = pred_impacts[0][:2]  # Take mean pred
        error_dist = np.sqrt((pred_latlon[0] - actual['lat'])**2 + (pred_latlon[1] - actual['lon'])**2)
        print(f'Validation Error (degrees): {error_dist}')
    else:
        print('No past impact data or predictions.')

# Test API key and get available NEOs
def test_api_key(api_key):
    """Test if API key works by getting today's NEOs"""
    url = f"https://api.nasa.gov/neo/rest/v1/feed/today?api_key={api_key}"
    try:
        response = requests.get(url, timeout=30)
        print(f"API Key test - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"API Key works! Found {data.get('element_count', 0)} NEOs today")
            return True, data
        else:
            print(f"API Key test failed: {response.text}")
            return False, None
    except Exception as e:
        print(f"API Key test error: {e}")
        return False, None

def get_available_neo_ids(api_key):
    """Get list of available NEO IDs"""
    url = f"https://api.nasa.gov/neo/rest/v1/feed/today?api_key={api_key}"
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            data = response.json()
            neo_ids = []
            for date, neos in data.get('near_earth_objects', {}).items():
                for neo in neos:
                    neo_ids.append(neo.get('neo_reference_id', ''))
            return neo_ids[:5]  # Return first 5 NEOs
        return []
    except Exception as e:
        print(f"Error getting NEO list: {e}")
        return []

# Function to save asteroid data for globe visualization
def save_asteroid_data_for_globe(neo_id, api_key):
    """Fetch and save asteroid data specifically for globe.html visualization"""
    import json
    from datetime import datetime
    
    try:
        print(f"Fetching data for asteroid {neo_id}...")
        neo_data = fetch_neo_data(neo_id, api_key)
        
        # Get the raw API response for complete data
        url = f"https://api.nasa.gov/neo/rest/v1/neo/{neo_id}?api_key={api_key}"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            raw_data = response.json()
            
            # Find future close approaches
            close_approaches = raw_data.get('close_approach_data', [])
            now = datetime.now()
            future_approaches = []
            
            for approach in close_approaches:
                approach_date = approach.get('close_approach_date')
                if approach_date:
                    try:
                        approach_dt = datetime.strptime(approach_date, '%Y-%m-%d')
                        if approach_dt > now:
                            future_approaches.append(approach)
                    except:
                        pass
            
            # Create data structure for globe visualization
            globe_data = {
                'neo_id': neo_id,
                'name': raw_data.get('name', 'Unknown'),
                'diameter_km': raw_data.get('estimated_diameter', {}).get('kilometers', {}).get('estimated_diameter_max', 1.0),
                'is_hazardous': raw_data.get('is_potentially_hazardous_asteroid', False),
                'orbital_data': raw_data.get('orbital_data', {}),
                'future_approaches': future_approaches[:5],  # Next 5 approaches
                'all_approaches': close_approaches[:10]  # Recent approaches for trajectory
            }
            
            # Save to JSON file
            with open('asteroid_data.json', 'w') as f:
                json.dump(globe_data, f, indent=2, default=str)
            
            print(f"Data saved to asteroid_data.json")
            print(f"Asteroid: {globe_data['name']}")
            print(f"Diameter: {globe_data['diameter_km']} km")
            print(f"Future approaches: {len(future_approaches)}")
            
            if future_approaches:
                next_approach = future_approaches[0]
                print(f"Next approach: {next_approach.get('close_approach_date')}")
                print(f"Miss distance: {next_approach.get('miss_distance', {}).get('astronomical', 'Unknown')} AU")
            
            return globe_data
        else:
            print(f"Error fetching raw data: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Error saving asteroid data: {e}")
        return None

# Main Pipeline
if __name__ == "__main__":
    api_key = "e2bs0vwfexPyVZrPxIgwU3fBphNhKBHkCyu6pY4C"
    
    # Test API key first
    print("Testing API key...")
    api_works, today_data = test_api_key(api_key)
    
    if not api_works:
        print("API key test failed. Please check your API key.")
        print("You can get a free API key from: https://api.nasa.gov/")
        exit(1)
    
    # Fetch data for asteroid 2000433 specifically for globe visualization
    print("\n=== Fetching data for asteroid 2000433 for globe visualization ===")
    asteroid_data = save_asteroid_data_for_globe("2000433", api_key)
    
    if asteroid_data:
        print("\n=== Running full pipeline for trajectory analysis ===")
        # Also run the full pipeline for trajectory analysis
        try:
            neo_data = fetch_neo_data("2000433", api_key)
            print("Sampling and propagating trajectories...")
            variants, impacts, times = sample_and_propagate(neo_data)
            print(f"Generated {len(variants)} trajectory variants")
            
            print("Computing impact probabilities...")
            probs, lon, lat = compute_impact_probs(impacts)
            
            print("Creating visualizations...")
            plot_impact_map(probs, lon, lat, neo_data)
            plot_uncertainty_tube(variants, times, "2000433")
            validate_model(impacts, neo_data['actual_impact'])
            
            print("Pipeline complete. Check impact_map.png and uncertainty_tube.html")
            print("Asteroid data saved to asteroid_data.json for globe visualization")
            
        except Exception as e:
            print(f"Error in pipeline: {e}")
            print("Continuing with asteroid data for globe visualization...")
            import traceback
            traceback.print_exc()
    else:
        print("Failed to fetch asteroid data for globe visualization")