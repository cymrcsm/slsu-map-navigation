const CATEGORIES = [
  {
    "id": "ALL",
    "name": "All Categories"
  },
  {
    "id": "admin-offices",
    "name": "Administrative & Management Offices",
    "color": "#8A6A45"
  },
  {
    "id": "academic-departments",
    "name": "Academic Departments & College Deans",
    "color": "#4E6B7C"
  },
  {
    "id": "faculty-rooms",
    "name": "Faculty Rooms & Consultation Desks",
    "color": "#5E7F8C"
  },
  {
    "id": "classrooms",
    "name": "Instructional Classrooms & Lecture Halls",
    "color": "#3F6B8A"
  },
  {
    "id": "laboratories",
    "name": "Specialized Technical & Simulation Laboratories",
    "color": "#2F6E6B"
  },
  {
    "id": "student-orgs",
    "name": "Student Organizations & Leadership Offices",
    "color": "#7A5C8E"
  },
  {
    "id": "libraries",
    "name": "Libraries & Information Centers",
    "color": "#4A5D8F"
  },
  {
    "id": "health-services",
    "name": "Medical, Health & Student Support Services",
    "color": "#A85C6B"
  },
  {
    "id": "food-commercial",
    "name": "Canteens, Food Hubs & Commercial Centers",
    "color": "#C97F3A"
  },
  {
    "id": "comfort-rooms",
    "name": "Comfort Rooms & Hygiene Facilities (CR)",
    "color": "#6E8A9A"
  },
  {
    "id": "lodging",
    "name": "Lodging, Residential & Dormitory Facilities",
    "color": "#9A6E4E"
  },
  {
    "id": "sports-recreation",
    "name": "Sports Grounds, Gymnasiums & Recreation",
    "color": "#4F7A5E"
  },
  {
    "id": "security-gates",
    "name": "Security, Gates & Military Headquarters",
    "color": "#6B4F3A"
  },
  {
    "id": "parking-waiting",
    "name": "Parking & Transit Waiting Areas",
    "color": "#6E7A6F"
  },
  {
    "id": "auxiliary-services",
    "name": "Auxiliary & Community Services",
    "color": "#8E7A4E"
  },
  {
    "id": "stock-archives",
    "name": "Stock Rooms, Bodegas & Archives",
    "color": "#6E6257"
  }
];

const LOCATIONS = [
 {
  "id": "aits-office",
  "name": "AITS Office",
  "acronym": "AITS",
  "building": "Industrial Technology Building 2",
  "categories": [
   "student-orgs",
   "health-services",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   92.8,
   438.6
  ],
  "textH": 0.68,
  "description": "Office of a recognised student organization."
 },
 {
  "id": "archives-center",
  "name": "Archives Center",
  "acronym": "AC",
  "building": "Administration Building",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   204.7,
   459.1
  ],
  "textH": 0.75,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "area-1",
  "name": "Area 1",
  "acronym": "AREA1",
  "building": "Industrial Technology Building 3",
  "categories": [
   "classrooms",
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   84.2,
   459.3
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "area-3",
  "name": "Area 3",
  "acronym": "AREA3",
  "building": "Industrial Technology Building 3",
  "categories": [
   "classrooms",
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   100,
   459.4
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "area-4",
  "name": "Area 4",
  "acronym": "AREA4",
  "building": "Industrial Technology Building 3",
  "categories": [
   "classrooms",
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   100,
   457.4
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "area-5",
  "name": "Area 5",
  "acronym": "AREA5",
  "building": "Industrial Technology Building 3",
  "categories": [
   "classrooms",
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   108.1,
   459.4
  ],
  "textH": 0.74,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "arkyn-s-snack-house",
  "name": "Arkyn's Snack House",
  "acronym": "ASH",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   144.6,
   339.4
  ],
  "textH": 0.58,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "as-101",
  "name": "AS-101",
  "acronym": "AS-101",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   202.4,
   351.9
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "as-102",
  "name": "AS-102",
  "acronym": "AS-102",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   211.4,
   351.9
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "as-103",
  "name": "AS-103",
  "acronym": "AS-103",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   220.1,
   351.9
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "as-104",
  "name": "AS-104",
  "acronym": "AS-104",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   229.1,
   351.9
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "as-105",
  "name": "AS-105",
  "acronym": "AS-105",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   229.6,
   390
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "as-106",
  "name": "AS-106",
  "acronym": "AS-106",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   221.8,
   390
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "as-107",
  "name": "AS-107",
  "acronym": "AS-107",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   208.7,
   390
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "as-108",
  "name": "AS-108",
  "acronym": "AS-108",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   201.4,
   390.2
  ],
  "textH": 0.7,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "assessment-area",
  "name": "Assessment Area",
  "acronym": "AA",
  "building": "SLSU Main Campus",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   88.4,
   145.8
  ],
  "textH": 1.16,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "bargo-production",
  "name": "BARGO Production",
  "acronym": "BARGO",
  "building": "SLSU Main Campus",
  "categories": [
   "auxiliary-services",
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   152.5,
   351.6
  ],
  "textH": 0.73,
  "description": "Auxiliary unit or community service provided by the university."
 },
 {
  "id": "barracks",
  "name": "Barracks",
  "acronym": "",
  "building": "Barracks",
  "categories": [
   "security-gates",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   43.7,
   209.1
  ],
  "textH": 0.71,
  "description": "Security post, campus gate or military training headquarters."
 },
 {
  "id": "basketball-court",
  "name": "Basketball Court",
  "acronym": "BC",
  "building": "Physical Education Building",
  "categories": [
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "Open daily, 6:00 AM - 8:00 PM",
  "coords": [
   148.1,
   204.3
  ],
  "textH": 0.76,
  "description": "Sports ground or recreation facility open to students and staff."
 },
 {
  "id": "beach-volleyball-court",
  "name": "Beach Volleyball Court",
  "acronym": "BVC",
  "building": "SLSU Main Campus",
  "categories": [
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "Open daily, 6:00 AM - 8:00 PM",
  "coords": [
   119.7,
   199.3
  ],
  "textH": 1.05,
  "description": "Sports ground or recreation facility open to students and staff."
 },
 {
  "id": "business-auxiliary-and-resource-generation-off",
  "name": "Business, Auxiliary, and Resource Generation Office (BARGO)",
  "acronym": "BARGO",
  "building": "Administration Building",
  "categories": [
   "admin-offices",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   215.3,
   411.2
  ],
  "textH": 0.85,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "campus-oval",
  "name": "Campus Oval",
  "acronym": "CO",
  "building": "SLSU Main Campus",
  "categories": [
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "Open daily, 6:00 AM - 8:00 PM",
  "coords": [
   144.7,
   261.5
  ],
  "textH": 3.74,
  "description": "Sports ground or recreation facility open to students and staff."
 },
 {
  "id": "cashier",
  "name": "Cashier",
  "acronym": "",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   230,
   412.5
  ],
  "textH": 0.62,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "cb-101",
  "name": "CB-101",
  "acronym": "CB-101",
  "building": "Criminology Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   46.7,
   298
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "cb-102",
  "name": "CB-102",
  "acronym": "CB-102",
  "building": "Criminology Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   46.3,
   291.6
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "cb-103",
  "name": "CB-103",
  "acronym": "CB-103",
  "building": "Criminology Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   46,
   285.3
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "cb-104",
  "name": "CB-104",
  "acronym": "CB-104",
  "building": "Criminology Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   45.8,
   278.9
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "center-for-organic-and-natural-food-research-c",
  "name": "Center for Organic and Natural Food Research (CONFOR) and Common Service Facility",
  "acronym": "CONFOR",
  "building": "Center for Organic and Natural Food Research (CONFOR) and Common Service Facility",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   111.7,
   503.3
  ],
  "textH": 1.06,
  "description": "Campus location."
 },
 {
  "id": "chemistry-lab",
  "name": "Chemistry Lab",
  "acronym": "CL",
  "building": "Engineering Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   80.2,
   379.2
  ],
  "textH": 0.93,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "cjso-office",
  "name": "CJSO Office",
  "acronym": "CJSO",
  "building": "Faculty of Criminal Justice Building",
  "categories": [
   "student-orgs",
   "health-services",
   "security-gates",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   40.5,
   246.8
  ],
  "textH": 0.83,
  "description": "Office of a recognised student organisation or council."
 },
 {
  "id": "cm-snack-house",
  "name": "CM Snack House",
  "acronym": "CM",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   147.1,
   339.4
  ],
  "textH": 0.7,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "comfort-room",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   169.8,
   473.4
  ],
  "textH": 1.18,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-2",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   243.6,
   391.5
  ],
  "textH": 1.18,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-3",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "Criminology Building",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   44.3,
   272.6
  ],
  "textH": 0.95,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-4",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "Criminology Building",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   42.4,
   311.4
  ],
  "textH": 0.95,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-5",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   243.7,
   350.5
  ],
  "textH": 0.88,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-6",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   142.1,
   351.6
  ],
  "textH": 0.32,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-7",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "Library",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   172.3,
   342.3
  ],
  "textH": 0.73,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-8",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   258.7,
   277.4
  ],
  "textH": 0.73,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-9",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   75.7,
   389.1
  ],
  "textH": 0.67,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-10",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   65.4,
   449.9
  ],
  "textH": 0.99,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-room-11",
  "name": "Comfort Room",
  "acronym": "CR",
  "building": "SLSU Main Campus",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   135.6,
   126
  ],
  "textH": 0.33,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "comfort-rooms",
  "name": "Comfort Rooms",
  "acronym": "CR",
  "building": "Medical-Dental Clinic",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   131.5,
   161.4
  ],
  "textH": 0.37,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "commandants-office",
  "name": "Commandants Office",
  "acronym": "CO",
  "building": "Barracks",
  "categories": [
   "admin-offices",
   "academic-departments",
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   43.8,
   215.5
  ],
  "textH": 0.98,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "commission-on-audit",
  "name": "Commission on Audit",
  "acronym": "CA",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   205.3,
   459.6
  ],
  "textH": 0.68,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "conference-room",
  "name": "Conference Room",
  "acronym": "CR",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   239.5,
   426
  ],
  "textH": 0.92,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "confor-and-csf-office",
  "name": "CONFOR and CSF Office",
  "acronym": "CONFOR",
  "building": "Center for Organic and Natural Food Research (CONFOR) and Common Service Facility",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   122,
   503.8
  ],
  "textH": 0.74,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "cpe-lab-1",
  "name": "CPE Lab 1",
  "acronym": "CPE",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   147.4,
   385.7
  ],
  "textH": 0.76,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "cpe-lab-2",
  "name": "CPE Lab 2",
  "acronym": "CPE",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   150,
   386.2
  ],
  "textH": 0.77,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "criminology-building",
  "name": "Criminology Building",
  "acronym": "CB",
  "building": "Criminology Building",
  "categories": [
   "academic-departments",
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   48.6,
   286.2
  ],
  "textH": 1.24,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "ct2-101",
  "name": "CT2-101",
  "acronym": "",
  "building": "Industrial Technology Building 2",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   87.4,
   438.6
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ct2-102",
  "name": "CT2-102",
  "acronym": "",
  "building": "Industrial Technology Building 2",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   86.6,
   437
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ct2-103",
  "name": "CT2-103",
  "acronym": "",
  "building": "Industrial Technology Building 2",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   96.6,
   438.6
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ct2-104",
  "name": "CT2-104",
  "acronym": "",
  "building": "Office of the Faculty of Industrial and Technology Management",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   98.5,
   437.9
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "cultural-affairs",
  "name": "Cultural Affairs",
  "acronym": "CA",
  "building": "Center for Organic and Natural Food Research (CONFOR) and Common Service Facility",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   130.5,
   505.9
  ],
  "textH": 0.65,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "cultural-affairs-office",
  "name": "Cultural Affairs Office",
  "acronym": "CAO",
  "building": "Industrial Technology Building 5",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   137.5,
   505.9
  ],
  "textH": 0.71,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "dean-s-office",
  "name": "Dean's Office",
  "acronym": "DO",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "academic-departments"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   168.9,
   424.8
  ],
  "textH": 0.72,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "dean-s-office-and-faculty-room",
  "name": "Dean's Office and Faculty Room",
  "acronym": "DOFR",
  "building": "Faculty of Criminal Justice Building",
  "categories": [
   "academic-departments",
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   45,
   253.8
  ],
  "textH": 0.87,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "dean-s-office-and-faculty-room-2",
  "name": "Dean's Office and Faculty Room",
  "acronym": "DOFR",
  "building": "SLSU Main Campus",
  "categories": [
   "academic-departments",
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   256.3,
   258
  ],
  "textH": 0.71,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "defense-room",
  "name": "Defense Room",
  "acronym": "DR",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "faculty-rooms",
   "classrooms",
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   158.1,
   425
  ],
  "textH": 0.83,
  "description": "Faculty workspace for preparation and student consultation."
 },
 {
  "id": "department-of-military-science-and-tactics-off",
  "name": "Department of Military Science and Tactics Office",
  "acronym": "DMSTO",
  "building": "Barracks",
  "categories": [
   "admin-offices",
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   43.6,
   221.6
  ],
  "textH": 0.86,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "dit-faculty-room",
  "name": "DIT Faculty Room",
  "acronym": "DIT",
  "building": "Industrial Technology Building 2",
  "categories": [
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   79,
   438.6
  ],
  "textH": 0.76,
  "description": "Faculty workspace for preparation and student consultation."
 },
 {
  "id": "don-macchiatos",
  "name": "Don Macchiatos",
  "acronym": "DM",
  "building": "Food Mart",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   212.9,
   486.3
  ],
  "textH": 0.81,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "duri-to",
  "name": "Duri-To",
  "acronym": "",
  "building": "Quality Assurance Center",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   204.5,
   479.5
  ],
  "textH": 0.55,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "elt-102",
  "name": "ELT-102",
  "acronym": "ELT-102",
  "building": "Industrial Technology Building 1",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   91.4,
   411.7
  ],
  "textH": 0.38,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "empty-stall",
  "name": "Empty Stall",
  "acronym": "ES",
  "building": "Food Mart",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   215.3,
   483.8
  ],
  "textH": 0.93,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "empty-stall-2",
  "name": "Empty Stall",
  "acronym": "ES",
  "building": "Food Mart",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   210.5,
   488.9
  ],
  "textH": 0.93,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "engineering-building",
  "name": "Engineering Building",
  "acronym": "EB",
  "building": "Engineering Building",
  "categories": [
   "academic-departments",
   "faculty-rooms",
   "classrooms",
   "laboratories",
   "student-orgs"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   83.4,
   360.2
  ],
  "textH": 1.24,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "faculty-of-criminal-justice-building",
  "name": "Faculty of Criminal Justice Building",
  "acronym": "FCJB",
  "building": "Faculty of Criminal Justice Building",
  "categories": [
   "academic-departments",
   "faculty-rooms",
   "laboratories",
   "student-orgs",
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   48.1,
   248.4
  ],
  "textH": 0.99,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "faculty-of-industrial-and-technology-managemen",
  "name": "Faculty of Industrial and Technology Management",
  "acronym": "FITM",
  "building": "Faculty of Industrial and Technology Management",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   62.7,
   428.3
  ],
  "textH": 1.16,
  "description": "Campus location."
 },
 {
  "id": "faculty-room",
  "name": "Faculty Room",
  "acronym": "FR",
  "building": "Physical Education Building",
  "categories": [
   "academic-departments",
   "faculty-rooms",
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   138.3,
   183.9
  ],
  "textH": 0.86,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "faculty-room-2",
  "name": "Faculty Room",
  "acronym": "FR",
  "building": "SLSU Main Campus",
  "categories": [
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   134,
   427.8
  ],
  "textH": 0.94,
  "description": "Faculty workspace for preparation and student consultation."
 },
 {
  "id": "faculty-room-3",
  "name": "Faculty Room",
  "acronym": "FR",
  "building": "SLSU Main Campus",
  "categories": [
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   256.3,
   265
  ],
  "textH": 0.71,
  "description": "Faculty workspace for preparation and student consultation."
 },
 {
  "id": "food-court-fc",
  "name": "Food Court (FC)",
  "acronym": "FC",
  "building": "Medical-Dental Clinic",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   135.5,
   346.2
  ],
  "textH": 0.42,
  "description": "Campus location."
 },
 {
  "id": "food-mart",
  "name": "Food Mart",
  "acronym": "FM",
  "building": "Food Mart",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   192.1,
   486.4
  ],
  "textH": 1.12,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "fpst-101",
  "name": "FPST 101",
  "acronym": "FPST101",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   83.1,
   147.4
  ],
  "textH": 1,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "fpst-102",
  "name": "FPST 102",
  "acronym": "FPST102",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   83.4,
   142.3
  ],
  "textH": 1.03,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "fpst-103",
  "name": "FPST 103",
  "acronym": "FPST103",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   84.5,
   128.4
  ],
  "textH": 1.03,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "fpst-104",
  "name": "FPST 104",
  "acronym": "FPST104",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   85,
   121.6
  ],
  "textH": 1.03,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "fpst-faculty-room",
  "name": "FPST Faculty Room",
  "acronym": "FPST",
  "building": "SLSU Main Campus",
  "categories": [
   "academic-departments",
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   93.8,
   137.2
  ],
  "textH": 1.15,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "free-wifi-zone",
  "name": "Free Wifi Zone",
  "acronym": "FWZ",
  "building": "Supply and Property Building",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   198.6,
   495.2
  ],
  "textH": 0.75,
  "description": "Campus location."
 },
 {
  "id": "fruitz-blend-and-food-beverage",
  "name": "Fruitz: Blend and Food Beverage",
  "acronym": "FBFB",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   148,
   345.7
  ],
  "textH": 0.5,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "garments",
  "name": "Garments",
  "acronym": "",
  "building": "Office of the Faculty of Industrial and Technology Management",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   113.6,
   438.6
  ],
  "textH": 0.76,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "gender-and-development-center-gad",
  "name": "Gender and Development Center (GAD)",
  "acronym": "GAD",
  "building": "Administration Building",
  "categories": [
   "admin-offices",
   "health-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   220.5,
   460.3
  ],
  "textH": 0.66,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "graduate-duties-gs-11",
  "name": "Graduate Duties GS-11",
  "acronym": "GDG",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   229.9,
   70.1
  ],
  "textH": 1.05,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "graduate-duties-gs-12",
  "name": "Graduate Duties GS-12",
  "acronym": "GDG",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   256.5,
   70.1
  ],
  "textH": 1.05,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "graduate-programs-operations-office",
  "name": "Graduate Programs Operations Office",
  "acronym": "GPOO",
  "building": "SLSU Main Campus",
  "categories": [
   "admin-offices",
   "academic-departments"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   251.6,
   70
  ],
  "textH": 0.79,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "grandstand",
  "name": "Grandstand",
  "acronym": "",
  "building": "Physical Education Building",
  "categories": [
   "classrooms",
   "sports-recreation",
   "security-gates",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   149.4,
   195.6
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "guard-house",
  "name": "Guard House",
  "acronym": "GH",
  "building": "SLSU Main Campus",
  "categories": [
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   266,
   437.6
  ],
  "textH": 0.84,
  "description": "Security post, campus gate or military training headquarters."
 },
 {
  "id": "guard-house-2",
  "name": "Guard House",
  "acronym": "GH",
  "building": "SLSU Main Campus",
  "categories": [
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   282.8,
   179.4
  ],
  "textH": 0.84,
  "description": "Security post, campus gate or military training headquarters."
 },
 {
  "id": "guard-house-3",
  "name": "Guard House",
  "acronym": "GH",
  "building": "SLSU Main Campus",
  "categories": [
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   48.5,
   396.9
  ],
  "textH": 0.57,
  "description": "Security post, campus gate or military training headquarters."
 },
 {
  "id": "handwashing-area",
  "name": "Handwashing Area",
  "acronym": "HA",
  "building": "Center for Organic and Natural Food Research (CONFOR) and Common Service Facility",
  "categories": [
   "comfort-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   104.9,
   503.6
  ],
  "textH": 0.33,
  "description": "Comfort room and hygiene facility."
 },
 {
  "id": "hotel-de-slsu",
  "name": "Hotel De SLSU",
  "acronym": "HDS",
  "building": "Hotel De SLSU",
  "categories": [
   "laboratories",
   "food-commercial",
   "lodging",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   237.7,
   161
  ],
  "textH": 1.42,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "htm-101",
  "name": "HTM-101",
  "acronym": "HTM-101",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   149.3,
   475.4
  ],
  "textH": 0.47,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "htm-102",
  "name": "HTM-102",
  "acronym": "HTM-102",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   155.7,
   475.4
  ],
  "textH": 0.47,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "htm-103",
  "name": "HTM-103",
  "acronym": "HTM-103",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   161.9,
   475.4
  ],
  "textH": 0.47,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "html-office",
  "name": "HTML Office",
  "acronym": "HTML",
  "building": "SLSU Main Campus",
  "categories": [
   "student-orgs",
   "health-services",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   144.1,
   473.5
  ],
  "textH": 0.56,
  "description": "Office of a recognised student organisation or council."
 },
 {
  "id": "human-resource-management-hrm",
  "name": "Human Resource Management (HRM)",
  "acronym": "HRM",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   202.5,
   426.3
  ],
  "textH": 1,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "hydraulics-lab",
  "name": "Hydraulics Lab",
  "acronym": "HL",
  "building": "Engineering Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   64.1,
   363.2
  ],
  "textH": 0.7,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "ias-conference-room",
  "name": "IAS Conference Room",
  "acronym": "IAS",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms",
   "libraries"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   237.8,
   378.1
  ],
  "textH": 1.1,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ias-faculty-room",
  "name": "IAS Faculty Room",
  "acronym": "IAS",
  "building": "SLSU Main Campus",
  "categories": [
   "academic-departments",
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   237.8,
   378.1
  ],
  "textH": 0.97,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "ict-1",
  "name": "ICT-1",
  "acronym": "ICT-1",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   157.5,
   427.8
  ],
  "textH": 0.58,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ict-2",
  "name": "ICT-2",
  "acronym": "ICT-2",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   163.8,
   427.8
  ],
  "textH": 0.61,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ict-3",
  "name": "ICT-3",
  "acronym": "ICT-3",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   170.3,
   427.8
  ],
  "textH": 0.62,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ie-103",
  "name": "IE-103",
  "acronym": "IE-103",
  "building": "SLSU Main Campus",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   256,
   271.7
  ],
  "textH": 0.72,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "ilab-1",
  "name": "iLAB-1",
  "acronym": "",
  "building": "SLSU Main Campus",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   132.9,
   424.5
  ],
  "textH": 0.61,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "ilab-2",
  "name": "iLAB-2",
  "acronym": "",
  "building": "SLSU Main Campus",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   138.9,
   424.5
  ],
  "textH": 0.63,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "ilab-3",
  "name": "iLAB-3",
  "acronym": "",
  "building": "SLSU Main Campus",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   145.4,
   424.5
  ],
  "textH": 0.63,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "in-collaboration-with-information-technology-d",
  "name": "In Collaboration with Information Technology Department and Research, Development and Extension Office",
  "acronym": "CITDRDEO",
  "building": "SLSU ICT Center",
  "categories": [
   "admin-offices",
   "academic-departments"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   57.3,
   413
  ],
  "textH": 0.75,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "industrial-technology-building-1",
  "name": "Industrial Technology Building 1",
  "acronym": "ITB1",
  "building": "Industrial Technology Building 1",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   69.7,
   417
  ],
  "textH": 1.16,
  "description": "Campus location."
 },
 {
  "id": "industrial-technology-building-2",
  "name": "Industrial Technology Building 2",
  "acronym": "ITB2",
  "building": "Industrial Technology Building 2",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   75.7,
   437.9
  ],
  "textH": 1.16,
  "description": "Campus location."
 },
 {
  "id": "industrial-technology-building-3",
  "name": "Industrial Technology Building 3",
  "acronym": "ITB3",
  "building": "Industrial Technology Building 3",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   78.6,
   458.5
  ],
  "textH": 1.16,
  "description": "Campus location."
 },
 {
  "id": "industrial-technology-building-4",
  "name": "Industrial Technology Building 4",
  "acronym": "ITB4",
  "building": "Industrial Technology Building 4",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   80.3,
   476.6
  ],
  "textH": 1.16,
  "description": "Campus location."
 },
 {
  "id": "industrial-technology-building-5",
  "name": "Industrial Technology Building 5",
  "acronym": "ITB5",
  "building": "Industrial Technology Building 5",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   159.1,
   504.4
  ],
  "textH": 1.16,
  "description": "Campus location."
 },
 {
  "id": "innovation-assets-management-and-transfer-unit",
  "name": "Innovation Assets Management and Transfer Unit",
  "acronym": "IAMTU",
  "building": "Research, Innovation and Extension Services (RIES) Building",
  "categories": [
   "admin-offices",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   179.8,
   344.6
  ],
  "textH": 0.56,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "institute-of-arts-and-sciences-building",
  "name": "Institute of Arts and Sciences Building",
  "acronym": "IASB",
  "building": "Institute of Arts and Sciences Building",
  "categories": [
   "academic-departments",
   "faculty-rooms",
   "classrooms",
   "laboratories",
   "student-orgs"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   235,
   371.2
  ],
  "textH": 1.24,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "interrogation-room",
  "name": "Interrogation Room",
  "acronym": "IR",
  "building": "Faculty of Criminal Justice Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   39.8,
   242.4
  ],
  "textH": 0.69,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "it-101",
  "name": "IT-101",
  "acronym": "IT-101",
  "building": "Industrial Technology Building 1",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   109.5,
   417.2
  ],
  "textH": 0.71,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-101-2",
  "name": "IT-101",
  "acronym": "IT-101",
  "building": "Industrial Technology Building 2",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   80.5,
   437.2
  ],
  "textH": 0.71,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-102",
  "name": "IT-102",
  "acronym": "IT-102",
  "building": "Industrial Technology Building 1",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   101.6,
   413.7
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-103",
  "name": "IT-103",
  "acronym": "IT-103",
  "building": "Industrial Technology Building 1",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   81.4,
   419.6
  ],
  "textH": 0.74,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-104",
  "name": "IT-104",
  "acronym": "IT-104",
  "building": "Industrial Technology Building 1",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   73.6,
   417.1
  ],
  "textH": 0.74,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-301",
  "name": "IT-301",
  "acronym": "IT-301",
  "building": "Industrial Technology Building 3",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   114.4,
   458
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-302",
  "name": "IT-302",
  "acronym": "IT-302",
  "building": "Industrial Technology Building 3",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   107.9,
   458
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-303",
  "name": "IT-303",
  "acronym": "IT-303",
  "building": "Industrial Technology Building 2",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   92,
   458.1
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-304",
  "name": "IT-304",
  "acronym": "IT-304",
  "building": "Industrial Technology Building 2",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   85.6,
   458.1
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-401",
  "name": "IT-401",
  "acronym": "IT-401",
  "building": "Industrial Technology Building 4",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   121,
   476.6
  ],
  "textH": 0.73,
  "description": "Campus location."
 },
 {
  "id": "it-402",
  "name": "IT-402",
  "acronym": "IT-402",
  "building": "Industrial Technology Building 4",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   101.8,
   470.7
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-403",
  "name": "IT-403",
  "acronym": "IT-403",
  "building": "Industrial Technology Building 4",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   102.5,
   481.3
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-404",
  "name": "IT-404",
  "acronym": "IT-404",
  "building": "Industrial Technology Building 4",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   82.5,
   476.6
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-501",
  "name": "IT-501",
  "acronym": "IT-501",
  "building": "Industrial Technology Building 5",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   173.8,
   508.2
  ],
  "textH": 0.73,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-502",
  "name": "IT-502",
  "acronym": "IT-502",
  "building": "Industrial Technology Building 5",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   167,
   508.2
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-503",
  "name": "IT-503",
  "acronym": "IT-503",
  "building": "Industrial Technology Building 5",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   159.4,
   508.2
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-504",
  "name": "IT-504",
  "acronym": "IT-504",
  "building": "Industrial Technology Building 5",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   152.5,
   508.2
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "it-505",
  "name": "IT-505",
  "acronym": "IT-505",
  "building": "Industrial Technology Building 5",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   144.4,
   508.2
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "jam-d-lite",
  "name": "Jam D' Lite",
  "acronym": "JDL",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   148,
   343.2
  ],
  "textH": 0.62,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "jam-d-lite-2",
  "name": "Jam D' Lite",
  "acronym": "JDL",
  "building": "Quality Assurance Center",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   208.4,
   479.5
  ],
  "textH": 0.68,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "julies-bakeshop",
  "name": "Julies Bakeshop",
  "acronym": "JB",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   147.9,
   348.4
  ],
  "textH": 0.68,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "khera-s-snack-house",
  "name": "Khera's Snack House",
  "acronym": "KSH",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   137.7,
   339.4
  ],
  "textH": 0.57,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "kitchen",
  "name": "Kitchen",
  "acronym": "",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   164.2,
   348.3
  ],
  "textH": 0.32,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "lab-area",
  "name": "Lab Area",
  "acronym": "LA",
  "building": "Office of the Faculty of Industrial and Technology Management",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   94.3,
   437.1
  ],
  "textH": 0.73,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "landbank-atm",
  "name": "Landbank ATM",
  "acronym": "LA",
  "building": "SLSU Main Campus",
  "categories": [
   "admin-offices",
   "food-commercial",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   267.1,
   447
  ],
  "textH": 0.68,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "library",
  "name": "Library",
  "acronym": "",
  "building": "Library",
  "categories": [
   "libraries"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 6:00 PM (Mon - Fri)",
  "coords": [
   229.2,
   324.4
  ],
  "textH": 1.47,
  "description": "Library and information resource centre."
 },
 {
  "id": "machineries",
  "name": "Machineries",
  "acronym": "",
  "building": "Engineering Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   64.7,
   376.9
  ],
  "textH": 0.4,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "main-gate",
  "name": "Main Gate",
  "acronym": "MG",
  "building": "SLSU Main Campus",
  "categories": [
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   264.7,
   434.5
  ],
  "textH": 0.7,
  "description": "Security post, campus gate or military training headquarters."
 },
 {
  "id": "marie-s-snack-house",
  "name": "Marie's Snack House",
  "acronym": "MSH",
  "building": "Medical-Dental Clinic",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   139.3,
   339.4
  ],
  "textH": 0.57,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "mecha-1",
  "name": "Mecha 1",
  "acronym": "MECHA1",
  "building": "Engineering Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   104.6,
   387.6
  ],
  "textH": 0.75,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "mecha-2",
  "name": "Mecha 2",
  "acronym": "MECHA2",
  "building": "Engineering Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   115,
   387.6
  ],
  "textH": 0.75,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "medical-dental-clinic",
  "name": "Medical-Dental Clinic",
  "acronym": "MC",
  "building": "Medical-Dental Clinic",
  "categories": [
   "admin-offices",
   "health-services",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   109.1,
   349.9
  ],
  "textH": 0.76,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "messhall-1",
  "name": "Messhall 1",
  "acronym": "M1",
  "building": "Related Subject Building 2",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   102.6,
   73.9
  ],
  "textH": 1.05,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "messhall-2",
  "name": "Messhall 2",
  "acronym": "M2",
  "building": "Related Subject Building 2",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   104.8,
   59.1
  ],
  "textH": 1.05,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "mmc-1",
  "name": "MMC 1",
  "acronym": "MMC1",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   172.4,
   386.2
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "mmc-2",
  "name": "MMC 2",
  "acronym": "MMC2",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   164.2,
   386.2
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "mmc-3",
  "name": "MMC 3",
  "acronym": "MMC3",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   156.3,
   386.2
  ],
  "textH": 0.75,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "multi-purpose-court-mpc",
  "name": "Multi Purpose Court (MPC)",
  "acronym": "MPC",
  "building": "Multi Purpose Court (MPC)",
  "categories": [
   "classrooms",
   "student-orgs",
   "sports-recreation",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   182.5,
   146.4
  ],
  "textH": 2.12,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "multi-faith-room-old-ias-conference-room",
  "name": "Multi-Faith Room/old IAS Conference Room",
  "acronym": "MROICR",
  "building": "SLSU Main Campus",
  "categories": [
   "health-services",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   215.5,
   390
  ],
  "textH": 0.71,
  "description": "Medical, health or student welfare service point."
 },
 {
  "id": "multi-media-center-mmc",
  "name": "Multi-Media Center (MMC)",
  "acronym": "MMC",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "classrooms",
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   161.9,
   384.2
  ],
  "textH": 1.35,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "nstp-office",
  "name": "NSTP Office",
  "acronym": "NSTP",
  "building": "Barracks",
  "categories": [
   "admin-offices",
   "academic-departments",
   "security-gates",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   43.8,
   203.1
  ],
  "textH": 0.71,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "observation-room",
  "name": "Observation Room",
  "acronym": "OR",
  "building": "Faculty of Criminal Justice Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   34.5,
   242.3
  ],
  "textH": 0.68,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "office-of-techvoc",
  "name": "Office of Techvoc",
  "acronym": "OT",
  "building": "Faculty of Industrial and Technology Management",
  "categories": [
   "admin-offices",
   "academic-departments",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   59,
   420
  ],
  "textH": 0.92,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "office-of-the-dean",
  "name": "Office of the Dean",
  "acronym": "OD",
  "building": "Faculty of Industrial and Technology Management",
  "categories": [
   "academic-departments"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   61.3,
   429.3
  ],
  "textH": 0.89,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "office-of-the-director-for-quality-assurance",
  "name": "Office of the Director for Quality Assurance",
  "acronym": "ODQA",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   214.4,
   460.3
  ],
  "textH": 0.55,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "office-of-the-director-of-curriculum-innovatio",
  "name": "Office of the Director of Curriculum Innovation, Credentialing, and Life Long Learning",
  "acronym": "ODCICLLL",
  "building": "SLSU Main Campus",
  "categories": [
   "admin-offices",
   "academic-departments",
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   241.5,
   70
  ],
  "textH": 0.67,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "office-of-the-engineering-student-organization",
  "name": "Office of the Engineering Student Organization",
  "acronym": "OESO",
  "building": "Engineering Building",
  "categories": [
   "student-orgs",
   "health-services",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   79.2,
   393.6
  ],
  "textH": 0.53,
  "description": "Office of a recognised student organisation or council."
 },
 {
  "id": "office-of-the-faculty-of-industrial-and-techno",
  "name": "Office of the Faculty of Industrial and Technology Management",
  "acronym": "OFITM",
  "building": "Office of the Faculty of Industrial and Technology Management",
  "categories": [
   "academic-departments",
   "faculty-rooms"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   96.6,
   427.6
  ],
  "textH": 0.61,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "office-of-the-pice-slsu-student-chapter",
  "name": "Office of the PICE SLSU Student Chapter",
  "acronym": "OPSSC",
  "building": "Engineering Building",
  "categories": [
   "student-orgs",
   "health-services",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   77.9,
   332.3
  ],
  "textH": 0.66,
  "description": "Office of a recognised student organisation or council."
 },
 {
  "id": "office-of-the-president",
  "name": "Office of the President",
  "acronym": "OP",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   237.5,
   436.1
  ],
  "textH": 0.78,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "office-of-the-slsu-peso-manager",
  "name": "Office of the SLSU Peso Manager",
  "acronym": "OSPM",
  "building": "Faculty of Industrial and Technology Management",
  "categories": [
   "admin-offices",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   60.2,
   424.8
  ],
  "textH": 0.86,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "office-of-the-vice-president",
  "name": "Office of the Vice President",
  "acronym": "OVP",
  "building": "Research, Innovation and Extension Services (RIES) Building",
  "categories": [
   "admin-offices",
   "academic-departments",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   170.4,
   354.5
  ],
  "textH": 0.33,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "office-of-the-vice-president-for-academic-affa",
  "name": "Office of the Vice President for Academic Affairs (VPAA) Office of the Vice President for Administration and Finance (VPAF)",
  "acronym": "VPAA",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   212.5,
   426.1
  ],
  "textH": 0.73,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "open-air-bench",
  "name": "Open Air Bench",
  "acronym": "OAB",
  "building": "Criminology Building",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   58.2,
   218.8
  ],
  "textH": 0.86,
  "description": "Campus location."
 },
 {
  "id": "open-air-bench-2",
  "name": "Open-Air Bench",
  "acronym": "OB",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   123.1,
   189.6
  ],
  "textH": 0.87,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   135.5,
   407.4
  ],
  "textH": 2.76,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches-2",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   183.9,
   464.4
  ],
  "textH": 0.69,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches-3",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "Industrial Technology Building 5",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   154.3,
   495.8
  ],
  "textH": 0.69,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches-4",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   63.3,
   222.6
  ],
  "textH": 0.57,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches-5",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "Multi-Media Center (MMC)",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   197,
   480.3
  ],
  "textH": 0.69,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches-6",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "Food Mart",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   63.6,
   336.3
  ],
  "textH": 0.87,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches-7",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   62.5,
   318.3
  ],
  "textH": 0.73,
  "description": "Campus location."
 },
 {
  "id": "open-air-benches-8",
  "name": "Open-Air Benches",
  "acronym": "OB",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   170,
   354
  ],
  "textH": 0.73,
  "description": "Campus location."
 },
 {
  "id": "parking-area",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   266.8,
   422.2
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-2",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   266.6,
   413.5
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-3",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   160.1,
   383
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-4",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   142.9,
   440.3
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-5",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   161.9,
   440.4
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-6",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   148.1,
   462.4
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-7",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   176.2,
   462.7
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-8",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   147.1,
   362.7
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-9",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   184.7,
   335.5
  ],
  "textH": 0.75,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-10",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   176.1,
   364
  ],
  "textH": 0.81,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-11",
  "name": "Parking Area",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   125.4,
   388.3
  ],
  "textH": 0.81,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   119.6,
   418.7
  ],
  "textH": 0.38,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-2",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   130.4,
   413.8
  ],
  "textH": 0.19,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-3",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   192.8,
   348
  ],
  "textH": 0.19,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-4",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "Office of the Faculty of Industrial and Technology Management",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   259.7,
   443.6
  ],
  "textH": 0.38,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-5",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   257.2,
   449.8
  ],
  "textH": 0.38,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-6",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   251.5,
   455.8
  ],
  "textH": 0.98,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-7",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   245.7,
   462
  ],
  "textH": 0.98,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-8",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   73.4,
   396.9
  ],
  "textH": 0.98,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "parking-area-motorcycles-9",
  "name": "Parking Area (Motorcycles)",
  "acronym": "PA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   65.7,
   386.6
  ],
  "textH": 0.38,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "pe-room",
  "name": "PE Room",
  "acronym": "PE",
  "building": "Faculty of Criminal Justice Building",
  "categories": [
   "laboratories",
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   45.1,
   242
  ],
  "textH": 0.43,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "physical-education-building",
  "name": "Physical Education Building",
  "acronym": "PEB",
  "building": "Physical Education Building",
  "categories": [
   "academic-departments",
   "faculty-rooms",
   "classrooms",
   "health-services",
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   148,
   181.1
  ],
  "textH": 0.92,
  "description": "Department or college office overseeing academic programs and faculty."
 },
 {
  "id": "physical-plant-and-development-management-offi",
  "name": "Physical Plant and Development Management Office",
  "acronym": "PPDMO",
  "building": "Barracks",
  "categories": [
   "admin-offices",
   "laboratories",
   "auxiliary-services",
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   48.3,
   185.6
  ],
  "textH": 1.13,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "physics-lab",
  "name": "Physics Lab",
  "acronym": "PL",
  "building": "Engineering Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   79.9,
   372.2
  ],
  "textH": 1,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "plenary-hall",
  "name": "Plenary Hall",
  "acronym": "PH",
  "building": "Medical-Dental Clinic",
  "categories": [
   "admin-offices",
   "classrooms",
   "libraries",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   123.5,
   343.6
  ],
  "textH": 0.79,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "product-display-and-business-center",
  "name": "Product Display and Business Center",
  "acronym": "PDBC",
  "building": "Center for Organic and Natural Food Research (CONFOR) and Common Service Facility",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   114.5,
   503.8
  ],
  "textH": 0.66,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "prose-laboratory",
  "name": "Prose Laboratory",
  "acronym": "PL",
  "building": "Related Subjects Building",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   52.2,
   364.9
  ],
  "textH": 0.96,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "prose-lecture-area",
  "name": "Prose Lecture Area",
  "acronym": "PLA",
  "building": "Related Subjects Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   51.8,
   356.8
  ],
  "textH": 0.93,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "quality-assurance-center",
  "name": "Quality Assurance Center",
  "acronym": "QAC",
  "building": "Quality Assurance Center",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   217.8,
   459.6
  ],
  "textH": 0.82,
  "description": "Campus location."
 },
 {
  "id": "radyo-pilipinas",
  "name": "Radyo Pilipinas",
  "acronym": "RP",
  "building": "SLSU Main Campus",
  "categories": [
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   271.1,
   198.7
  ],
  "textH": 0.79,
  "description": "Auxiliary unit or community service provided by the university."
 },
 {
  "id": "receiving-area",
  "name": "Receiving Area",
  "acronym": "RA",
  "building": "SLSU Main Campus",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   87.8,
   119.6
  ],
  "textH": 1.07,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "records-management-office",
  "name": "Records Management Office",
  "acronym": "RMO",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   206.4,
   455
  ],
  "textH": 0.72,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "registrar",
  "name": "Registrar",
  "acronym": "",
  "building": "Administration Building",
  "categories": [
   "admin-offices"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   242,
   417.6
  ],
  "textH": 0.66,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "related-subject-building-2",
  "name": "Related Subject Building 2",
  "acronym": "RSB2",
  "building": "Related Subject Building 2",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   104.8,
   66.4
  ],
  "textH": 2.09,
  "description": "Campus location."
 },
 {
  "id": "related-subjects-building",
  "name": "Related Subjects Building",
  "acronym": "RSB",
  "building": "Related Subjects Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   53.5,
   341.2
  ],
  "textH": 1.26,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "research-innovation-and-extension-services-building",
  "name": "Research, Innovation and Extension Services (RIES) Building",
  "acronym": "RIESB",
  "building": "Research, Innovation and Extension Services (RIES) Building",
  "categories": [
   "admin-offices",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   183.8,
   349.7
  ],
  "textH": 1.24,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "ries-ethics-and-review-services-ries-managemen",
  "name": "RIES Ethics and Review Services RIES Management Information Office RIES Communication Office RIES Knowledge Management Office",
  "acronym": "RIES",
  "building": "Research, Innovation and Extension Services (RIES) Building",
  "categories": [
   "admin-offices",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   179.5,
   350.5
  ],
  "textH": 0.58,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "rizal-gate",
  "name": "Rizal Gate",
  "acronym": "RG",
  "building": "SLSU Main Campus",
  "categories": [
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   287.5,
   179.5
  ],
  "textH": 1.05,
  "description": "Security post, campus gate or military training headquarters."
 },
 {
  "id": "room-e-101",
  "name": "Room E-101",
  "acronym": "RE",
  "building": "Engineering Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   78.3,
   341.4
  ],
  "textH": 0.87,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "room-e-102",
  "name": "Room E-102",
  "acronym": "RE",
  "building": "Engineering Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   78.8,
   349.8
  ],
  "textH": 0.87,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "room-e-103",
  "name": "Room E-103",
  "acronym": "RE",
  "building": "Engineering Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   79.2,
   358.7
  ],
  "textH": 0.87,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "room-e-104",
  "name": "Room E-104",
  "acronym": "RE",
  "building": "Engineering Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   79.5,
   365.4
  ],
  "textH": 0.87,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "rs-101",
  "name": "RS-101",
  "acronym": "RS-101",
  "building": "Related Subjects Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   49.6,
   325.7
  ],
  "textH": 0.71,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "rs-102",
  "name": "RS-102",
  "acronym": "RS-102",
  "building": "Related Subjects Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   50.2,
   333.6
  ],
  "textH": 0.71,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "rs-103",
  "name": "RS-103",
  "acronym": "RS-103",
  "building": "Related Subjects Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   50.7,
   341.3
  ],
  "textH": 0.72,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "rs-104",
  "name": "RS-104",
  "acronym": "RS-104",
  "building": "Related Subjects Building",
  "categories": [
   "classrooms"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   51.1,
   349.1
  ],
  "textH": 0.72,
  "description": "Classroom or lecture space used for scheduled instruction."
 },
 {
  "id": "san-roque-gate",
  "name": "San Roque Gate",
  "acronym": "SRG",
  "building": "SLSU ICT Center",
  "categories": [
   "security-gates"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   45.7,
   397.8
  ],
  "textH": 1.57,
  "description": "Security post, campus gate or military training headquarters."
 },
 {
  "id": "sepak-takraw-court",
  "name": "Sepak Takraw Court",
  "acronym": "STC",
  "building": "SLSU Main Campus",
  "categories": [
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "Open daily, 6:00 AM - 8:00 PM",
  "coords": [
   175.3,
   204.6
  ],
  "textH": 0.88,
  "description": "Sports ground or recreation facility open to students and staff."
 },
 {
  "id": "slsu-ict-center",
  "name": "SLSU ICT Center",
  "acronym": "SLSU",
  "building": "SLSU ICT Center",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   58.5,
   411
  ],
  "textH": 1.47,
  "description": "Campus location."
 },
 {
  "id": "smart-lab",
  "name": "Smart Lab",
  "acronym": "SL",
  "building": "SLSU Main Campus",
  "categories": [
   "laboratories"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   145.3,
   427.8
  ],
  "textH": 0.73,
  "description": "Specialised laboratory or simulation facility for hands-on technical work."
 },
 {
  "id": "stock-room",
  "name": "Stock Room",
  "acronym": "SR",
  "building": "Faculty of Criminal Justice Building",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   34.5,
   246.7
  ],
  "textH": 0.86,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "stock-room-2",
  "name": "Stock Room",
  "acronym": "SR",
  "building": "SLSU Main Campus",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   236.5,
   350.4
  ],
  "textH": 0.91,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "stock-room-3",
  "name": "Stock Room",
  "acronym": "SR",
  "building": "SLSU Main Campus",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   259.2,
   252
  ],
  "textH": 0.85,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "stock-room-4",
  "name": "Stock Room",
  "acronym": "SR",
  "building": "Multi-Media Center (MMC)",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   179.8,
   388.6
  ],
  "textH": 0.38,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "storage-area",
  "name": "Storage Area",
  "acronym": "SA",
  "building": "SLSU Main Campus",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   88.6,
   135.6
  ],
  "textH": 1.26,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "storage-room",
  "name": "Storage Room",
  "acronym": "SR",
  "building": "SLSU Main Campus",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   162.9,
   343.3
  ],
  "textH": 0.32,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "storage-room-2",
  "name": "Storage Room",
  "acronym": "SR",
  "building": "SLSU Main Campus",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   175.4,
   344.7
  ],
  "textH": 0.56,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "student-dormitory-1",
  "name": "Student Dormitory 1",
  "acronym": "SD1",
  "building": "Student Dormitory 1",
  "categories": [
   "health-services",
   "lodging",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   199,
   63.4
  ],
  "textH": 0.97,
  "description": "Medical, health or student welfare service point."
 },
 {
  "id": "student-dormitory-2",
  "name": "Student Dormitory 2",
  "acronym": "SD2",
  "building": "Student Dormitory 2",
  "categories": [
   "health-services",
   "lodging",
   "auxiliary-services"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   153.4,
   59.4
  ],
  "textH": 1.07,
  "description": "Medical, health or student welfare service point."
 },
 {
  "id": "student-records-archives",
  "name": "Student Records Archives",
  "acronym": "SRA",
  "building": "Administration Building",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   224.3,
   439.3
  ],
  "textH": 0.88,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "student-records-archives-2",
  "name": "Student Records Archives",
  "acronym": "SRA",
  "building": "Administration Building",
  "categories": [
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   211.9,
   323
  ],
  "textH": 0.88,
  "description": "Records, storage and supply area maintained by the university."
 },
 {
  "id": "supply-and-property-building",
  "name": "Supply and Property Building",
  "acronym": "SPB",
  "building": "Supply and Property Building",
  "categories": [
   "admin-offices",
   "stock-archives"
  ],
  "floor": "Ground Floor",
  "hours": "8:00 AM - 5:00 PM (Mon - Fri)",
  "coords": [
   187.5,
   509
  ],
  "textH": 0.93,
  "description": "Administrative office handling university operations and student transactions."
 },
 {
  "id": "tennis-court",
  "name": "Tennis Court",
  "acronym": "TC",
  "building": "SLSU Main Campus",
  "categories": [
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "Open daily, 6:00 AM - 8:00 PM",
  "coords": [
   261.6,
   229.2
  ],
  "textH": 0.75,
  "description": "Sports ground or recreation facility open to students and staff."
 },
 {
  "id": "toilet-area",
  "name": "Toilet Area",
  "acronym": "TA",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   83.9,
   136
  ],
  "textH": 0.99,
  "description": "Campus location."
 },
 {
  "id": "toilet-area-2",
  "name": "Toilet Area",
  "acronym": "TA",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   85.5,
   114.8
  ],
  "textH": 0.99,
  "description": "Campus location."
 },
 {
  "id": "toilet-area-3",
  "name": "Toilet Area",
  "acronym": "TA",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   235.5,
   66.2
  ],
  "textH": 0.79,
  "description": "Campus location."
 },
 {
  "id": "toilet-area-4",
  "name": "Toilet Area",
  "acronym": "TA",
  "building": "SLSU Main Campus",
  "categories": [],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   117.4,
   144.4
  ],
  "textH": 0.88,
  "description": "Campus location."
 },
 {
  "id": "twin-s-snack-house",
  "name": "Twin's Snack House",
  "acronym": "TSH",
  "building": "Medical-Dental Clinic",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   141.8,
   339.4
  ],
  "textH": 0.57,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "volleyball-court",
  "name": "Volleyball Court",
  "acronym": "VC",
  "building": "Physical Education Building",
  "categories": [
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "Open daily, 6:00 AM - 8:00 PM",
  "coords": [
   134.7,
   201.9
  ],
  "textH": 0.98,
  "description": "Sports ground or recreation facility open to students and staff."
 },
 {
  "id": "volleyball-court-2",
  "name": "Volleyball Court",
  "acronym": "VC",
  "building": "SLSU Main Campus",
  "categories": [
   "sports-recreation"
  ],
  "floor": "Ground Floor",
  "hours": "Open daily, 6:00 AM - 8:00 PM",
  "coords": [
   161.7,
   201.9
  ],
  "textH": 0.98,
  "description": "Sports ground or recreation facility open to students and staff."
 },
 {
  "id": "waiting-area",
  "name": "Waiting Area",
  "acronym": "WA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   255.5,
   420.1
  ],
  "textH": 0.4,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "waiting-area-2",
  "name": "Waiting Area",
  "acronym": "WA",
  "building": "SLSU Main Campus",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   255.5,
   413.1
  ],
  "textH": 0.4,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "waiting-area-3",
  "name": "Waiting Area",
  "acronym": "WA",
  "building": "Administration Building",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   213.7,
   409.5
  ],
  "textH": 0.4,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "waiting-area-4",
  "name": "Waiting Area",
  "acronym": "WA",
  "building": "Administration Building",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   229.4,
   410.8
  ],
  "textH": 0.4,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "waiting-area-5",
  "name": "Waiting Area",
  "acronym": "WA",
  "building": "Administration Building",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   234.8,
   409.5
  ],
  "textH": 0.37,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "waiting-area-6",
  "name": "Waiting Area",
  "acronym": "WA",
  "building": "Administration Building",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   224.9,
   414.1
  ],
  "textH": 0.37,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "waiting-area-7",
  "name": "Waiting Area",
  "acronym": "WA",
  "building": "Administration Building",
  "categories": [
   "parking-waiting"
  ],
  "floor": "Ground Floor",
  "hours": "Open during campus hours",
  "coords": [
   244.9,
   421
  ],
  "textH": 0.37,
  "description": "Parking bay or transit waiting area."
 },
 {
  "id": "what-if-silogan",
  "name": "What If Silogan",
  "acronym": "WIS",
  "building": "SLSU Main Campus",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   148,
   340.6
  ],
  "textH": 0.61,
  "description": "Campus food outlet or commercial stall."
 },
 {
  "id": "yang-s-house",
  "name": "Yang's House",
  "acronym": "YH",
  "building": "Food Mart",
  "categories": [
   "food-commercial"
  ],
  "floor": "Ground Floor",
  "hours": "7:00 AM - 7:00 PM (Mon - Sat)",
  "coords": [
   208.3,
   491
  ],
  "textH": 0.95,
  "description": "Campus food outlet or commercial stall."
 }
];
