document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData();
  const fileInput = document.getElementById('cityModel');
  const latitude = document.getElementById('latitude').value;
  const longitude = document.getElementById('longitude').value;
  const date = document.getElementById('date').value.replace(/-/g, ''); // Format YYYYMMDD

  formData.append('cityModel', fileInput.files[0]);

  try {
    // Fetch GHI dynamically using NASA POWER API
    const ghi = await fetchGHI(latitude, longitude, date);

    if (!ghi) {
      alert('Failed to retrieve GHI data. Please try again.');
      return;
    }

    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      const params = new URLSearchParams({
        model: data.filename,
        lat: latitude,
        lng: longitude,
        date: date,
        ghi: ghi, // Include dynamically fetched GHI
      });
      console.log(ghi);
      window.location.href = `viewer.html?${params.toString()}`;
    }
  } catch (error) {
    console.error('Upload failed:', error);
  }
});

// Fetch GHI using NASA POWER API
async function fetchGHI(lat, lon, date) {
  const apiUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&start=${date}&end=${date}&format=JSON`;

  try {
    const response = await fetch(apiUrl);
    if (response.ok) {
      const data = await response.json();
      return data.properties.parameter.ALLSKY_SFC_SW_DWN[date]; // Extract GHI value
    } else {
      console.error('Failed to fetch GHI:', response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error fetching GHI:', error);
    return null;
  }
}
