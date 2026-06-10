export const fetchWeatherForecast = async (lat, lon) => {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY || 'REPLACE_WITH_YOUR_KEY'
  
  if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_KEY') {
    console.warn("OpenWeatherMap API Key is missing. Using fallback mocked forecast.")
    return null
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${apiKey}`
    )
    if (!response.ok) throw new Error('Error fetching weather data')
    
    const data = await response.json()
    
    // OpenWeatherMap /forecast returns data every 3 hours. 
    // We group by day to get one forecast per day (e.g. max temp and generic status)
    const dailyData = {}
    
    data.list.forEach(item => {
      const date = new Date(item.dt * 1000)
      const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }) // 'lun', 'mar', etc.
      const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1)
      
      if (!dailyData[capitalizedDay]) {
        dailyData[capitalizedDay] = {
          day: capitalizedDay,
          temps: [],
          descriptions: [],
          iconCodes: []
        }
      }
      
      dailyData[capitalizedDay].temps.push(item.main.temp)
      dailyData[capitalizedDay].descriptions.push(item.weather[0].description)
      dailyData[capitalizedDay].iconCodes.push(item.weather[0].icon)
    })
    
    // Convert to the format expected by the frontend
    const forecastArray = Object.values(dailyData).slice(0, 5).map(dayData => {
      // Get max temp for the day
      const maxTemp = Math.max(...dayData.temps)
      
      // Get most frequent description
      const mostFrequentDesc = dayData.descriptions.sort((a,b) =>
        dayData.descriptions.filter(v => v===a).length
        - dayData.descriptions.filter(v => v===b).length
      ).pop()
      
      // Map OpenWeather icon code to Lucide Icon name
      const oWIcon = dayData.iconCodes[0] // just take the first one or most frequent
      let lucideIcon = 'Cloud'
      if (oWIcon.includes('01')) lucideIcon = 'Sun'
      else if (oWIcon.includes('02') || oWIcon.includes('03') || oWIcon.includes('04')) lucideIcon = 'CloudSun'
      else if (oWIcon.includes('09') || oWIcon.includes('10')) lucideIcon = 'CloudRain'
      else if (oWIcon.includes('11')) lucideIcon = 'CloudLightning'
      else if (oWIcon.includes('13')) lucideIcon = 'CloudSnow'

      // Capitalize status
      const status = mostFrequentDesc.charAt(0).toUpperCase() + mostFrequentDesc.slice(1)

      return {
        day: dayData.day,
        temp: `${Math.round(maxTemp)}°C`,
        status: status,
        icon: lucideIcon
      }
    })

    return forecastArray

  } catch (error) {
    console.error('Weather fetching failed:', error)
    return null
  }
}
