// ==========================================
// SEARCH WORDS  -  what visitors type, and what they mean
// ==========================================
// Hand-editable. Loaded before app.js; read by its search (section 10).
// Case, spaces and dashes do not matter ("ITB 1" = "itb1" = "ITB-1").
//
// SEARCH_WORDS: everyday words for a kind of place. Each entry sends its words
// to a category id (see CATEGORIES in campus-data.js) or to places whose name
// contains `name`. Typing one of the words exactly puts those places first.
const SEARCH_WORDS = [
  { category: 'comfort-rooms',
    words: ['cr', 'comfort room', 'restroom', 'rest room', 'toilet', 'washroom', 'lavatory',
            'ladies', 'gents', 'men', 'mens', "men's", 'women', 'womens', "women's",
            'male', 'female', 'banyo', 'kasilyas'] },
  { category: 'food-commercial',
    words: ['canteen', 'cafeteria', 'kantina', 'food', 'eat', 'snack', 'snacks', 'meal',
            'lunch', 'kaon', 'pagkaon'] },
  { name: 'Clinic',      // the Medical-Dental Clinic; its category also holds guidance offices
    words: ['clinic', 'nurse', 'doctor', 'dentist', 'dental', 'medical', 'sick', 'first aid',
            'health', 'hospital'] },
  { name: 'Registrar',
    words: ['registrar', 'enrollment', 'enrolment', 'enroll', 'enrol', 'records', 'tor',
            'transcript'] },
  { name: 'Cashier',
    words: ['cashier', 'pay', 'payment', 'tuition', 'fee', 'fees', 'bayad'] },
  { category: 'libraries',
    words: ['library', 'lib', 'books', 'book', 'reading', 'study area'] },
  { category: 'sports-recreation',
    words: ['gym', 'gymnasium', 'sports', 'court', 'basketball', 'volleyball'] },
  { category: 'lodging',
    words: ['dorm', 'dormitory', 'boarding', 'lodging'] },
  { category: 'parking-waiting',
    words: ['parking', 'park', 'car'] }
];

// SEARCH_BUILDING_NAMES: short forms of each building, exactly as the building
// is written in the directory. Typing one shows the building first, then the
// places inside it.
const SEARCH_BUILDING_NAMES = {
  'Administration Building': ['AB', 'Admin'],
  'Archives Center': ['AC'],
  'Center for Organic and Natural Food Research (CONFOR) and Common Service Facility': ['CONFOR', 'CSF'],
  'Criminal Justice Building': ['CJB', 'CJ'],
  'Criminology Building': ['CB', 'Crim'],
  'Education Building': ['EDB', 'Educ'],
  'Engineering Building': ['EB', 'Engg', 'Engr'],
  'Faculty of Engineering Department Building': ['FEDB'],
  'Faculty of Industrial and Technology Management': ['FITM'],
  'Office of the Faculty of Industrial and Technology Management': ['FITM'],
  'Food Mart': ['FM'],
  'Food Technology Building': ['FTB', 'FoodTech', 'Food Tech'],
  'Graduate Studies Building': ['GSB'],
  'Hospitality and Tourism Management Building': ['HTMB', 'HTM'],
  'Industrial Technology Building 1': ['ITB1', 'Indus 1'],
  'Industrial Technology Building 2': ['ITB2', 'Indus 2'],
  'Industrial Technology Building 3': ['ITB3', 'Indus 3'],
  'Industrial Technology Building 4': ['ITB4', 'Indus 4'],
  'Industrial Technology Building 5': ['ITB5', 'Indus 5'],
  'Information Technology Building': ['ITB', 'IT'],
  'Institute of Arts and Sciences Building': ['IASB', 'IAS'],
  'Library': ['Lib'],
  'Multi Purpose Court (MPC)': ['MPC'],
  'Multi-Media Center (MMC)': ['MMC'],
  'NSTP CWTS Building': ['NSTP', 'CWTS'],
  'Physical Education Building': ['PEB', 'PE'],
  'Quality Assurance Center': ['QAC', 'QA'],
  'Radyo Pilipinas': ['RP'],
  'Related Subjects Building': ['RSB'],
  'Related Subject Building 2': ['RSB2'],
  'Research, Innovation, and Extension Services Building': ['RIESB', 'RIES'],
  'SLSU ICT Center': ['ICT'],
  'Student Center': ['SC'],
  'Student Dormitory 1': ['SD1', 'Dorm 1'],
  'Student Dormitory 2': ['SD2', 'Dorm 2'],
  'Supply and Property Building': ['SPB', 'Supply']
};
