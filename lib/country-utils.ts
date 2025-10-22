// Utility functions for country name and code mapping

// Define the country abbreviation interface
export interface CountryAbbreviation {
  countryName: string
  fips10: string
  iso3166Alpha2: string
}

// Cache for country abbreviations
let countryAbbreviationsCache: CountryAbbreviation[] | null = null

// Function to fetch country abbreviations
export async function fetchCountryAbbreviations(): Promise<CountryAbbreviation[]> {
  // Return from cache if available
  if (countryAbbreviationsCache) {
    return countryAbbreviationsCache
  }

  try {
    const response = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Complete_Country_Abbreviations_FIPS_ISO-SVn4fHmSEifKhXmLZ9Vq34TqSOvTXB.csv",
    )
    const csvText = await response.text()

    // Parse CSV
    const rows = csvText.split("\n")
    const headers = rows[0].split(",")

    const countryNameIndex = headers.findIndex((h) => h.trim() === "Country Name")
    const fipsIndex = headers.findIndex((h) => h.trim() === "FIPS 10")
    const isoIndex = headers.findIndex((h) => h.trim() === "ISO 3166-1 Alpha-2")

    if (countryNameIndex === -1 || fipsIndex === -1 || isoIndex === -1) {
      throw new Error("CSV headers not found")
    }

    const abbreviations: CountryAbbreviation[] = []

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue

      const columns = rows[i].split(",")

      if (columns.length > Math.max(countryNameIndex, fipsIndex, isoIndex)) {
        abbreviations.push({
          countryName: columns[countryNameIndex].trim(),
          fips10: columns[fipsIndex].trim(),
          iso3166Alpha2: columns[isoIndex].trim(),
        })
      }
    }

    // Store in cache
    countryAbbreviationsCache = abbreviations
    return abbreviations
  } catch (error) {
    console.error("Error fetching country abbreviations:", error)
    return []
  }
}

// Function to get country code from country name
export function getCountryCode(
  countryName: string,
  abbreviations: CountryAbbreviation[],
  codeType: "iso" | "fips" = "iso",
): string {
  // Normalize country name for comparison
  const normalizedName = countryName.trim().toLowerCase()

  // Find matching country
  const country = abbreviations.find((c) => c.countryName.toLowerCase() === normalizedName)

  if (!country) {
    // Try partial matching if exact match not found
    const partialMatch = abbreviations.find(
      (c) =>
        normalizedName.includes(c.countryName.toLowerCase()) || c.countryName.toLowerCase().includes(normalizedName),
    )

    if (partialMatch) {
      return codeType === "iso" ? partialMatch.iso3166Alpha2 : partialMatch.fips10
    }

    // Return the original name if no match found
    return countryName
  }

  return codeType === "iso" ? country.iso3166Alpha2 : country.fips10
}

// Function to get country name from code
export function getCountryName(code: string, abbreviations: CountryAbbreviation[]): string {
  const country = abbreviations.find((c) => c.iso3166Alpha2 === code || c.fips10 === code)

  return country ? country.countryName : code
}

// Function to create a mapping between country names and codes
export function createCountryCodeMap(
  abbreviations: CountryAbbreviation[],
  codeType: "iso" | "fips" = "iso",
): Record<string, string> {
  const map: Record<string, string> = {}

  abbreviations.forEach((country) => {
    const code = codeType === "iso" ? country.iso3166Alpha2 : country.fips10
    if (code) {
      map[country.countryName] = code
    }
  })

  return map
}

// Country mapping utility functions

// Define the country mapping interface
export interface CountryMapping {
  countryName: string
  fips10: string
  iso3166Alpha2: string
}

// Create a mapping of country codes to full names
export const countryMappings: CountryMapping[] = [
  { countryName: "Aruba", fips10: "AA", iso3166Alpha2: "AW" },
  { countryName: "Antigua and Barbuda", fips10: "AC", iso3166Alpha2: "AG" },
  { countryName: "United Arab Emirates", fips10: "AE", iso3166Alpha2: "AE" },
  { countryName: "Afghanistan", fips10: "AF", iso3166Alpha2: "AF" },
  { countryName: "Algeria", fips10: "AG", iso3166Alpha2: "DZ" },
  { countryName: "Azerbaijan", fips10: "AJ", iso3166Alpha2: "AZ" },
  { countryName: "Albania", fips10: "AL", iso3166Alpha2: "AL" },
  { countryName: "Armenia", fips10: "AM", iso3166Alpha2: "AM" },
  { countryName: "Andorra", fips10: "AN", iso3166Alpha2: "AD" },
  { countryName: "Angola", fips10: "AO", iso3166Alpha2: "AO" },
  { countryName: "Argentina", fips10: "AR", iso3166Alpha2: "AR" },
  { countryName: "Australia", fips10: "AS", iso3166Alpha2: "AU" },
  { countryName: "Austria", fips10: "AU", iso3166Alpha2: "AT" },
  { countryName: "Anguilla", fips10: "AV", iso3166Alpha2: "AI" },
  { countryName: "Antarctica", fips10: "AY", iso3166Alpha2: "AQ" },
  { countryName: "Bahrain", fips10: "BA", iso3166Alpha2: "BH" },
  { countryName: "Barbados", fips10: "BB", iso3166Alpha2: "BB" },
  { countryName: "Botswana", fips10: "BC", iso3166Alpha2: "BW" },
  { countryName: "Bermuda", fips10: "BD", iso3166Alpha2: "BM" },
  { countryName: "Belgium", fips10: "BE", iso3166Alpha2: "BE" },
  { countryName: "Bahamas", fips10: "BF", iso3166Alpha2: "BS" },
  { countryName: "Bangladesh", fips10: "BG", iso3166Alpha2: "BD" },
  { countryName: "Belize", fips10: "BH", iso3166Alpha2: "BZ" },
  { countryName: "Bosnia-Herzegovina", fips10: "BK", iso3166Alpha2: "BA" },
  { countryName: "Bolivia", fips10: "BL", iso3166Alpha2: "BO" },
  { countryName: "Burma", fips10: "BM", iso3166Alpha2: "MM" },
  { countryName: "Benin", fips10: "BN", iso3166Alpha2: "BJ" },
  { countryName: "Belarus", fips10: "BO", iso3166Alpha2: "BY" },
  { countryName: "Solomon Islands", fips10: "BP", iso3166Alpha2: "SB" },
  { countryName: "Brazil", fips10: "BR", iso3166Alpha2: "BR" },
  { countryName: "Bhutan", fips10: "BT", iso3166Alpha2: "BT" },
  { countryName: "Bulgaria", fips10: "BU", iso3166Alpha2: "BG" },
  { countryName: "Brunei Darussalam", fips10: "BX", iso3166Alpha2: "BN" },
  { countryName: "Burundi", fips10: "BY", iso3166Alpha2: "BI" },
  { countryName: "Canada", fips10: "CA", iso3166Alpha2: "CA" },
  { countryName: "Cambodia", fips10: "CB", iso3166Alpha2: "KH" },
  { countryName: "Chad", fips10: "CD", iso3166Alpha2: "TD" },
  { countryName: "Sri Lanka", fips10: "CE", iso3166Alpha2: "LK" },
  { countryName: "Congo (Brazzaville)", fips10: "CF", iso3166Alpha2: "CG" },
  { countryName: "Congo (Kinshasa)", fips10: "CG", iso3166Alpha2: "CD" },
  { countryName: "China", fips10: "CH", iso3166Alpha2: "CN" },
  { countryName: "Chile", fips10: "CI", iso3166Alpha2: "CL" },
  { countryName: "Cayman Islands", fips10: "CJ", iso3166Alpha2: "KY" },
  { countryName: "Cocos Islands", fips10: "CK", iso3166Alpha2: "CC" },
  { countryName: "Cameroon", fips10: "CM", iso3166Alpha2: "CM" },
  { countryName: "Comoros", fips10: "CN", iso3166Alpha2: "KM" },
  { countryName: "Colombia", fips10: "CO", iso3166Alpha2: "CO" },
  { countryName: "Costa Rica", fips10: "CR", iso3166Alpha2: "CR" },
  { countryName: "Central African Rep", fips10: "CT", iso3166Alpha2: "CF" },
  { countryName: "Cuba", fips10: "CU", iso3166Alpha2: "CU" },
  { countryName: "Cape Verde", fips10: "CV", iso3166Alpha2: "CV" },
  { countryName: "Cook Islands", fips10: "CW", iso3166Alpha2: "CK" },
  { countryName: "Cyprus", fips10: "CY", iso3166Alpha2: "CY" },
  { countryName: "Denmark", fips10: "DA", iso3166Alpha2: "DK" },
  { countryName: "Djibouti", fips10: "DJ", iso3166Alpha2: "DJ" },
  { countryName: "Dominica", fips10: "DO", iso3166Alpha2: "DM" },
  { countryName: "Dominican Republic", fips10: "DR", iso3166Alpha2: "DO" },
  { countryName: "Ecuador", fips10: "EC", iso3166Alpha2: "EC" },
  { countryName: "Egypt", fips10: "EG", iso3166Alpha2: "EG" },
  { countryName: "Ireland", fips10: "EI", iso3166Alpha2: "IE" },
  { countryName: "Equatorial Guinea", fips10: "EK", iso3166Alpha2: "GQ" },
  { countryName: "Estonia", fips10: "EN", iso3166Alpha2: "EE" },
  { countryName: "Eritrea", fips10: "ER", iso3166Alpha2: "ER" },
  { countryName: "El Salvador", fips10: "ES", iso3166Alpha2: "SV" },
  { countryName: "Ethiopia", fips10: "ET", iso3166Alpha2: "ET" },
  { countryName: "Czech Republic", fips10: "EZ", iso3166Alpha2: "CZ" },
  { countryName: "French Guiana", fips10: "FG", iso3166Alpha2: "GF" },
  { countryName: "Finland", fips10: "FI", iso3166Alpha2: "FI" },
  { countryName: "Fiji", fips10: "FJ", iso3166Alpha2: "FJ" },
  { countryName: "Falkland Islands", fips10: "FK", iso3166Alpha2: "FK" },
  { countryName: "Micronesia", fips10: "FM", iso3166Alpha2: "FM" },
  { countryName: "Faroe Islands", fips10: "FO", iso3166Alpha2: "FO" },
  { countryName: "French Polynesia", fips10: "FP", iso3166Alpha2: "PF" },
  { countryName: "France", fips10: "FR", iso3166Alpha2: "FR" },
  { countryName: "Gambia", fips10: "GA", iso3166Alpha2: "GM" },
  { countryName: "Gabon", fips10: "GB", iso3166Alpha2: "GA" },
  { countryName: "Republic of Georgia", fips10: "GG", iso3166Alpha2: "GE" },
  { countryName: "Ghana", fips10: "GH", iso3166Alpha2: "GH" },
  { countryName: "Gibraltar", fips10: "GI", iso3166Alpha2: "GI" },
  { countryName: "Grenada", fips10: "GJ", iso3166Alpha2: "GD" },
  { countryName: "Guernsey", fips10: "GK", iso3166Alpha2: "GG" },
  { countryName: "Greenland", fips10: "GL", iso3166Alpha2: "GL" },
  { countryName: "Germany", fips10: "GM", iso3166Alpha2: "DE" },
  { countryName: "Guadeloupe", fips10: "GP", iso3166Alpha2: "GP" },
  { countryName: "Greece", fips10: "GR", iso3166Alpha2: "GR" },
  { countryName: "Guatemala", fips10: "GT", iso3166Alpha2: "GT" },
  { countryName: "Guinea", fips10: "GV", iso3166Alpha2: "GN" },
  { countryName: "Guyana", fips10: "GY", iso3166Alpha2: "GY" },
  { countryName: "Haiti", fips10: "HA", iso3166Alpha2: "HT" },
  { countryName: "Hong Kong", fips10: "HK", iso3166Alpha2: "HK" },
  { countryName: "Honduras", fips10: "HO", iso3166Alpha2: "HN" },
  { countryName: "Croatia", fips10: "HR", iso3166Alpha2: "HR" },
  { countryName: "Hungary", fips10: "HU", iso3166Alpha2: "HU" },
  { countryName: "Iceland", fips10: "IC", iso3166Alpha2: "IS" },
  { countryName: "Indonesia", fips10: "ID", iso3166Alpha2: "ID" },
  { countryName: "Isle of Man", fips10: "IM", iso3166Alpha2: "IM" },
  { countryName: "India", fips10: "IN", iso3166Alpha2: "IN" },
  { countryName: "Iran", fips10: "IR", iso3166Alpha2: "IR" },
  { countryName: "Israel", fips10: "IS", iso3166Alpha2: "IL" },
  { countryName: "Italy", fips10: "IT", iso3166Alpha2: "IT" },
  { countryName: "Cote d'Ivoire", fips10: "IV", iso3166Alpha2: "CI" },
  { countryName: "Iraq", fips10: "IZ", iso3166Alpha2: "IQ" },
  { countryName: "Japan", fips10: "JA", iso3166Alpha2: "JP" },
  { countryName: "Jersey", fips10: "JE", iso3166Alpha2: "JE" },
  { countryName: "Jamaica", fips10: "JM", iso3166Alpha2: "JM" },
  { countryName: "Jordan", fips10: "JO", iso3166Alpha2: "JO" },
  { countryName: "Kenya", fips10: "KE", iso3166Alpha2: "KE" },
  { countryName: "Kyrgyzstan", fips10: "KG", iso3166Alpha2: "KG" },
  { countryName: "North Korea", fips10: "KN", iso3166Alpha2: "KP" },
  { countryName: "Kiribati", fips10: "KR", iso3166Alpha2: "KI" },
  { countryName: "South Korea", fips10: "KS", iso3166Alpha2: "KR" },
  { countryName: "Christmas Island", fips10: "KT", iso3166Alpha2: "CX" },
  { countryName: "Kuwait", fips10: "KU", iso3166Alpha2: "KW" },
  { countryName: "Kosovo", fips10: "KV", iso3166Alpha2: "XK" },
  { countryName: "Kazakhstan", fips10: "KZ", iso3166Alpha2: "KZ" },
  { countryName: "Laos", fips10: "LA", iso3166Alpha2: "LA" },
  { countryName: "Lebanon", fips10: "LE", iso3166Alpha2: "LB" },
  { countryName: "Latvia", fips10: "LG", iso3166Alpha2: "LV" },
  { countryName: "Lithuania", fips10: "LH", iso3166Alpha2: "LT" },
  { countryName: "Liberia", fips10: "LI", iso3166Alpha2: "LR" },
  { countryName: "Slovak Republic", fips10: "LO", iso3166Alpha2: "SK" },
  { countryName: "Liechtenstein", fips10: "LS", iso3166Alpha2: "LI" },
  { countryName: "Lesotho", fips10: "LT", iso3166Alpha2: "LS" },
  { countryName: "Luxembourg", fips10: "LU", iso3166Alpha2: "LU" },
  { countryName: "Libya", fips10: "LY", iso3166Alpha2: "LY" },
  { countryName: "Madagascar", fips10: "MA", iso3166Alpha2: "MG" },
  { countryName: "Martinique", fips10: "MB", iso3166Alpha2: "MQ" },
  { countryName: "Macau", fips10: "MC", iso3166Alpha2: "MO" },
  { countryName: "Moldova", fips10: "MD", iso3166Alpha2: "MD" },
  { countryName: "Mayotte", fips10: "MF", iso3166Alpha2: "YT" },
  { countryName: "Mongolia", fips10: "MG", iso3166Alpha2: "MN" },
  { countryName: "Montserrat", fips10: "MH", iso3166Alpha2: "MS" },
  { countryName: "Malawi", fips10: "MI", iso3166Alpha2: "MW" },
  { countryName: "Macedonia", fips10: "MK", iso3166Alpha2: "MK" },
  { countryName: "Montenegro", fips10: "MJ", iso3166Alpha2: "ME" },
  { countryName: "Mali", fips10: "ML", iso3166Alpha2: "ML" },
  { countryName: "Monaco", fips10: "MN", iso3166Alpha2: "MC" },
  { countryName: "Morocco", fips10: "MO", iso3166Alpha2: "MA" },
  { countryName: "Mauritius", fips10: "MP", iso3166Alpha2: "MU" },
  { countryName: "Mauritania", fips10: "MR", iso3166Alpha2: "MR" },
  { countryName: "Malta", fips10: "MT", iso3166Alpha2: "MT" },
  { countryName: "Oman", fips10: "MU", iso3166Alpha2: "OM" },
  { countryName: "Maldives", fips10: "MV", iso3166Alpha2: "MV" },
  { countryName: "Mexico", fips10: "MX", iso3166Alpha2: "MX" },
  { countryName: "Malaysia", fips10: "MY", iso3166Alpha2: "MY" },
  { countryName: "Mozambique", fips10: "MZ", iso3166Alpha2: "MZ" },
  { countryName: "New Caledonia", fips10: "NC", iso3166Alpha2: "NC" },
  { countryName: "Niue", fips10: "NE", iso3166Alpha2: "NU" },
  { countryName: "Norfolk Island", fips10: "NF", iso3166Alpha2: "NF" },
  { countryName: "Niger", fips10: "NG", iso3166Alpha2: "NE" },
  { countryName: "Vanuatu", fips10: "NH", iso3166Alpha2: "VU" },
  { countryName: "Nigeria", fips10: "NI", iso3166Alpha2: "NG" },
  { countryName: "Netherlands", fips10: "NL", iso3166Alpha2: "NL" },
  { countryName: "Norway", fips10: "NO", iso3166Alpha2: "NO" },
  { countryName: "Nepal", fips10: "NP", iso3166Alpha2: "NP" },
  { countryName: "Nauru", fips10: "NR", iso3166Alpha2: "NR" },
  { countryName: "Suriname", fips10: "NS", iso3166Alpha2: "SR" },
  { countryName: "Netherlands Antilles", fips10: "NT", iso3166Alpha2: "AN" },
  { countryName: "Nicaragua", fips10: "NU", iso3166Alpha2: "NI" },
  { countryName: "New Zealand", fips10: "NZ", iso3166Alpha2: "NZ" },
  { countryName: "South Sudan", fips10: "OD", iso3166Alpha2: "SS" },
  { countryName: "Paraguay", fips10: "PA", iso3166Alpha2: "PY" },
  { countryName: "Pitcairn Island", fips10: "PC", iso3166Alpha2: "PN" },
  { countryName: "Peru", fips10: "PE", iso3166Alpha2: "PE" },
  { countryName: "Pakistan", fips10: "PK", iso3166Alpha2: "PK" },
  { countryName: "Poland", fips10: "PL", iso3166Alpha2: "PL" },
  { countryName: "Panama", fips10: "PM", iso3166Alpha2: "PA" },
  { countryName: "Portugal", fips10: "PO", iso3166Alpha2: "PT" },
  { countryName: "Papua New Guinea", fips10: "PP", iso3166Alpha2: "PG" },
  { countryName: "Palau", fips10: "PS", iso3166Alpha2: "PW" },
  { countryName: "Guinea-Bissau", fips10: "PU", iso3166Alpha2: "GW" },
  { countryName: "Qatar", fips10: "QA", iso3166Alpha2: "QA" },
  { countryName: "Serbia", fips10: "RI", iso3166Alpha2: "RS" },
  { countryName: "Reunion", fips10: "RE", iso3166Alpha2: "RE" },
  { countryName: "Marshall Islands", fips10: "RM", iso3166Alpha2: "MH" },
  { countryName: "Romania", fips10: "RO", iso3166Alpha2: "RO" },
  { countryName: "Philippines", fips10: "RP", iso3166Alpha2: "PH" },
  { countryName: "Russia", fips10: "RS", iso3166Alpha2: "RU" },
  { countryName: "Rwanda", fips10: "RW", iso3166Alpha2: "RW" },
  { countryName: "Saudi Arabia", fips10: "SA", iso3166Alpha2: "SA" },
]

// Function to get country name from code
export function getCountryNameFromCode(code: string): string {
  // Only match ISO 3166-1 alpha-2 now:
  const isoMatch = countryMappings.find((country) => country.iso3166Alpha2.toLowerCase() === code.toLowerCase())
  return isoMatch ? isoMatch.countryName : code
}

// Function to get country code from name
export function getCountryCodeFromName(name: string, codeType: "fips" | "iso" = "fips"): string {
  const match = countryMappings.find((country) => country.countryName.toLowerCase() === name.toLowerCase())

  if (match) {
    return codeType === "fips" ? match.fips10 : match.iso3166Alpha2
  }

  // If no match is found, return the original name
  return name
}

// Function to check if a string is a country code
export function isCountryCode(str: string): boolean {
  if (!str || str.length > 3) return false

  const isFips = countryMappings.some((country) => country.fips10.toLowerCase() === str.toLowerCase())
  const isIso = countryMappings.some((country) => country.iso3166Alpha2.toLowerCase() === str.toLowerCase())

  return isFips || isIso
}
