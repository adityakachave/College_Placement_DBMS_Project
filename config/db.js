const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;
let isConnected = false;
let connectionError = null;

// Initial Seed Data (Matches college_placement_management.sql exactly)
const mockData = {
    departments: [
        { department_id: 'DEPT-CSE', department_code: 'CSE', department_name: 'Computer Science and Engineering', head_of_department: 'Dr. Ramesh K. Sundaram, Ph.D. (IIT-B)', building_block: 'Sir M.V. Block, 3rd Floor', contact_email: 'hod.cse@rvce.edu.in' },
        { department_id: 'DEPT-ISE', department_code: 'ISE', department_name: 'Information Science and Engineering', head_of_department: 'Dr. Ananya P. Sharma, Ph.D. (IISc)', building_block: 'Dr. Kalam Block, 2nd Floor', contact_email: 'hod.ise@rvce.edu.in' },
        { department_id: 'DEPT-ECE', department_code: 'ECE', department_name: 'Electronics and Communication Engineering', head_of_department: 'Dr. Suresh V. Rao, Ph.D. (IIT-M)', building_block: 'C.V. Raman Block, 1st Floor', contact_email: 'hod.ece@rvce.edu.in' },
        { department_id: 'DEPT-MECH', department_code: 'MECH', department_name: 'Mechanical Engineering', head_of_department: 'Dr. Rajesh N. Patil, Ph.D. (IIT-R)', building_block: 'Workshop Complex, Ground Floor', contact_email: 'hod.mech@rvce.edu.in' },
        { department_id: 'DEPT-AIDS', department_code: 'AIDS', department_name: 'Artificial Intelligence & Data Science', head_of_department: 'Dr. Priya M. Varma, Ph.D. (IIIT-H)', building_block: 'Turing Technology Wing, 4th Floor', contact_email: 'hod.aids@rvce.edu.in' }
    ],
    placement_officers: [
        { officer_id: 'TPO-EMP-101', officer_name: 'Prof. Arvind Kulkarni', email: 'arvind.kulkarni@rvce.edu.in', phone_number: '+91-9845012341', designation: 'Dean - Corporate Relations & Placements', cabin_location: 'Admin Wing, Room 204' },
        { officer_id: 'TPO-EMP-104', officer_name: 'Prof. Meera Deshmukh', email: 'meera.deshmukh@rvce.edu.in', phone_number: '+91-9845012342', designation: 'Associate Director - Placements', cabin_location: 'Admin Wing, Room 205' },
        { officer_id: 'TPO-EMP-108', officer_name: 'Mr. Karthik Nair', email: 'karthik.nair@rvce.edu.in', phone_number: '+91-9845012343', designation: 'Senior Manager - Corporate Alliances', cabin_location: 'Placement Block, Room 102' }
    ],
    students: [
        { student_id: 'STU-2021-CS001', usn: '1RV21CS001', first_name: 'Aarav', last_name: 'Sharma', gender: 'Male', college_email: 'aarav.sharma.cs21@rvce.edu.in', personal_email: 'aaravsharma.dev@gmail.com', phone_number: '+91-9845110001', department_id: 'DEPT-CSE', cgpa: 9.42, tenth_percentage: 96.50, twelfth_percentage: 94.20, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/aaravsharma-dev', linkedin_url: 'https://linkedin.com/in/aarav-sharma-cs', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21CS001.pdf', placement_status: 'Placed' },
        { student_id: 'STU-2021-CS015', usn: '1RV21CS015', first_name: 'Sneha', last_name: 'Reddy', gender: 'Female', college_email: 'sneha.reddy.cs21@rvce.edu.in', personal_email: 'sneha.reddy99@gmail.com', phone_number: '+91-9845110002', department_id: 'DEPT-CSE', cgpa: 8.85, tenth_percentage: 93.00, twelfth_percentage: 90.50, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/snehareddy-cloud', linkedin_url: 'https://linkedin.com/in/sneha-reddy-swe', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21CS015.pdf', placement_status: 'Placed' },
        { student_id: 'STU-2021-IS022', usn: '1RV21IS022', first_name: 'Rohan', last_name: 'Gupta', gender: 'Male', college_email: 'rohan.gupta.is21@rvce.edu.in', personal_email: 'rohan.gupta.tech@gmail.com', phone_number: '+91-9845110003', department_id: 'DEPT-ISE', cgpa: 8.15, tenth_percentage: 90.00, twelfth_percentage: 86.50, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/rohan-gupta-fullstack', linkedin_url: 'https://linkedin.com/in/rohan-gupta-dev', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21IS022.pdf', placement_status: 'Placed' },
        { student_id: 'STU-2021-EC045', usn: '1RV21EC045', first_name: 'Ananya', last_name: 'Iyer', gender: 'Female', college_email: 'ananya.iyer.ec21@rvce.edu.in', personal_email: 'ananya.iyer.vlsi@gmail.com', phone_number: '+91-9845110004', department_id: 'DEPT-ECE', cgpa: 8.60, tenth_percentage: 94.50, twelfth_percentage: 92.00, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/ananya-iyer-embedded', linkedin_url: 'https://linkedin.com/in/ananya-iyer-ece', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21EC045.pdf', placement_status: 'Placed' },
        { student_id: 'STU-2021-AI010', usn: '1RV21AI010', first_name: 'Vikram', last_name: 'Singh', gender: 'Male', college_email: 'vikram.singh.ai21@rvce.edu.in', personal_email: 'vikram.singh.ai@gmail.com', phone_number: '+91-9845110005', department_id: 'DEPT-AIDS', cgpa: 9.10, tenth_percentage: 97.00, twelfth_percentage: 95.50, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/vikram-singh-ml', linkedin_url: 'https://linkedin.com/in/vikram-singh-ai', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21AI010.pdf', placement_status: 'Placed' },
        { student_id: 'STU-2021-ME030', usn: '1RV21ME030', first_name: 'Rahul', last_name: 'Nambiar', gender: 'Male', college_email: 'rahul.nambiar.me21@rvce.edu.in', personal_email: 'rahul.nambiar.mech@gmail.com', phone_number: '+91-9845110006', department_id: 'DEPT-MECH', cgpa: 7.20, tenth_percentage: 84.50, twelfth_percentage: 80.00, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/rahul-nambiar-cad', linkedin_url: 'https://linkedin.com/in/rahul-nambiar-mech', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21ME030.pdf', placement_status: 'Unplaced' },
        { student_id: 'STU-2021-CS088', usn: '1RV21CS088', first_name: 'Pooja', last_name: 'Hegde', gender: 'Female', college_email: 'pooja.hegde.cs21@rvce.edu.in', personal_email: 'pooja.hegde.dev@gmail.com', phone_number: '+91-9845110007', department_id: 'DEPT-CSE', cgpa: 6.75, tenth_percentage: 80.00, twelfth_percentage: 76.50, active_backlogs: 1, graduation_year: 2025, github_url: 'https://github.com/pooja-hegde-web', linkedin_url: 'https://linkedin.com/in/pooja-hegde-cs', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21CS088.pdf', placement_status: 'Unplaced' },
        { student_id: 'STU-2021-EC012', usn: '1RV21EC012', first_name: 'Aditya', last_name: 'Verma', gender: 'Male', college_email: 'aditya.verma.ec21@rvce.edu.in', personal_email: 'aditya.verma.tech@gmail.com', phone_number: '+91-9845110008', department_id: 'DEPT-ECE', cgpa: 8.25, tenth_percentage: 91.00, twelfth_percentage: 88.00, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/aditya-verma-circuits', linkedin_url: 'https://linkedin.com/in/aditya-verma-ec', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21EC012.pdf', placement_status: 'Unplaced' },
        { student_id: 'STU-2021-IS050', usn: '1RV21IS050', first_name: 'Divya', last_name: 'Menon', gender: 'Female', college_email: 'divya.menon.is21@rvce.edu.in', personal_email: 'divya.menon.research@gmail.com', phone_number: '+91-9845110009', department_id: 'DEPT-ISE', cgpa: 8.40, tenth_percentage: 92.50, twelfth_percentage: 89.00, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/divya-menon-systems', linkedin_url: 'https://linkedin.com/in/divya-menon-is', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21IS050.pdf', placement_status: 'Higher Studies' },
        { student_id: 'STU-2021-ME018', usn: '1RV21ME018', first_name: 'Tanmay', last_name: 'Bhat', gender: 'Male', college_email: 'tanmay.bhat.me21@rvce.edu.in', personal_email: 'tanmay.bhat.cad@gmail.com', phone_number: '+91-9845110010', department_id: 'DEPT-MECH', cgpa: 8.10, tenth_percentage: 88.00, twelfth_percentage: 86.00, active_backlogs: 0, graduation_year: 2025, github_url: 'https://github.com/tanmay-bhat-ansys', linkedin_url: 'https://linkedin.com/in/tanmay-bhat-me', resume_storage_url: 'https://cloud.rvce.edu.in/resumes/2025/1RV21ME018.pdf', placement_status: 'Placed' }
    ],
    student_skills: [
        { student_id: 'STU-2021-CS001', skill_name: 'C++', proficiency_level: 'Expert' },
        { student_id: 'STU-2021-CS001', skill_name: 'Data Structures & Algorithms', proficiency_level: 'Expert' },
        { student_id: 'STU-2021-CS001', skill_name: 'Distributed Systems', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-CS001', skill_name: 'MySQL & PostgreSQL', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-CS015', skill_name: 'Java 17', proficiency_level: 'Expert' },
        { student_id: 'STU-2021-CS015', skill_name: 'Spring Boot & Microservices', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-CS015', skill_name: 'Docker & Kubernetes', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-IS022', skill_name: 'Python', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-IS022', skill_name: 'Django Rest Framework', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-IS022', skill_name: 'React.js', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-EC045', skill_name: 'Embedded C', proficiency_level: 'Expert' },
        { student_id: 'STU-2021-EC045', skill_name: 'Verilog HDL / FPGA', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-EC045', skill_name: 'ARM Cortex Architecture', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-AI010', skill_name: 'Python & PyTorch', proficiency_level: 'Expert' },
        { student_id: 'STU-2021-AI010', skill_name: 'Computer Vision & LLMs', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-AI010', skill_name: 'TensorFlow & MLOps', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-ME030', skill_name: 'AutoCAD 3D', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-ME030', skill_name: 'SolidWorks & CATIA', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-ME030', skill_name: 'Thermodynamics & Heat Transfer', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-CS088', skill_name: 'JavaScript (ES6+)', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-CS088', skill_name: 'React.js & Node.js', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-CS088', skill_name: 'MySQL & Database Design', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-CS088', skill_name: 'Git & GitHub', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-EC012', skill_name: 'SystemVerilog', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-EC012', skill_name: 'VLSI Physical Design', proficiency_level: 'Intermediate' },
        { student_id: 'STU-2021-EC012', skill_name: 'Embedded C', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-IS050', skill_name: 'Distributed Systems', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-IS050', skill_name: 'Go (Golang)', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-IS050', skill_name: 'Linux Kernel & Shell Scripting', proficiency_level: 'Expert' },
        { student_id: 'STU-2021-ME018', skill_name: 'ANSYS Mechanical FEA', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-ME018', skill_name: 'MATLAB & Simulink', proficiency_level: 'Advanced' },
        { student_id: 'STU-2021-ME018', skill_name: 'Computational Fluid Dynamics', proficiency_level: 'Intermediate' }
    ],
    companies: [
        { company_id: 'CMP-GOOG-01', company_name: 'Google India Pvt Ltd', industry_domain: 'Software, Cloud & Artificial Intelligence', headquarters: 'Mountain View, CA (Bangalore Office)', website_url: 'https://careers.google.com', hr_contact_name: 'Ms. Neha Kapoor', hr_email: 'neha.kapoor@google.com', hr_phone: '+91-80-67210001', tier_category: 'Tier-1 (Super Dream)' },
        { company_id: 'CMP-MSFT-02', company_name: 'Microsoft India R&D Pvt Ltd', industry_domain: 'Cloud Computing & Enterprise Platforms', headquarters: 'Redmond, WA (Hyderabad IDC)', website_url: 'https://careers.microsoft.com', hr_contact_name: 'Mr. Siddharth Roy', hr_email: 'siddharth.roy@microsoft.com', hr_phone: '+91-40-66920002', tier_category: 'Tier-1 (Super Dream)' },
        { company_id: 'CMP-CSCO-03', company_name: 'Cisco Systems India Pvt Ltd', industry_domain: 'Networking, Security & Cloud Observability', headquarters: 'San Jose, CA (Bangalore Campus)', website_url: 'https://jobs.cisco.com', hr_contact_name: 'Ms. Ritu Mathur', hr_email: 'ritu.mathur@cisco.com', hr_phone: '+91-80-44260003', tier_category: 'Tier-2 (Dream)' },
        { company_id: 'CMP-QCOM-04', company_name: 'Qualcomm India Pvt Ltd', industry_domain: 'Semiconductors, 5G & Wireless Modems', headquarters: 'San Diego, CA (Bangalore R&D)', website_url: 'https://qualcomm.com/careers', hr_contact_name: 'Mr. Kunal Ghosh', hr_email: 'kunal.ghosh@qualcomm.com', hr_phone: '+91-80-66510004', tier_category: 'Tier-1 (Super Dream)' },
        { company_id: 'CMP-AMZN-07', company_name: 'Amazon Development Centre India', industry_domain: 'E-Commerce, Cloud Infrastructure (AWS)', headquarters: 'Seattle, WA (Bangalore World Trade Centre)', website_url: 'https://amazon.jobs', hr_contact_name: 'Ms. Tanya Sen', hr_email: 'tanya.sen@amazon.com', hr_phone: '+91-80-41005000', tier_category: 'Tier-1 (Super Dream)' },
        { company_id: 'CMP-TCS-05', company_name: 'Tata Consultancy Services Ltd', industry_domain: 'Digital Engineering & Cloud Services', headquarters: 'Mumbai, India', website_url: 'https://tcs.com/careers', hr_contact_name: 'Mr. Alok Pandey', hr_email: 'alok.pandey@tcs.com', hr_phone: '+91-22-67780005', tier_category: 'Tier-3 (Mass/Core)' },
        { company_id: 'CMP-LTTS-06', company_name: 'L&T Technology Services Ltd', industry_domain: 'Automotive, Industrial & Smart Plant R&D', headquarters: 'Vadodara / Mumbai, India', website_url: 'https://ltts.com/careers', hr_contact_name: 'Mr. Deepak Joshi', hr_email: 'deepak.joshi@ltts.com', hr_phone: '+91-265-6700006', tier_category: 'Tier-3 (Mass/Core)' }
    ],
    job_postings: [
        { job_id: 'JOB-2024-GOOG-SDE', company_id: 'CMP-GOOG-01', officer_in_charge: 'TPO-EMP-101', job_title: 'Software Development Engineer - 1 (L3)', job_description: 'Core backend engineering for scalable distributed systems, search infra, and high-performance APIs.', job_role_type: 'Full-Time SDE', ctc_annual_lpa: 32.50, min_cgpa_cutoff: 8.50, max_backlogs_allowed: 0, job_location: 'Bangalore (RMZ Infinity)', drive_date: '2026-04-15', registration_deadline: '2026-12-31 23:59:59', drive_status: 'Ongoing' },
        { job_id: 'JOB-2024-MSFT-SWE', company_id: 'CMP-MSFT-02', officer_in_charge: 'TPO-EMP-101', job_title: 'Software Development Engineer - Core Cloud', job_description: 'Design and implementation of distributed telemetry, Azure kernel tooling, and hyperscale cloud services.', job_role_type: 'Full-Time SDE', ctc_annual_lpa: 28.00, min_cgpa_cutoff: 8.00, max_backlogs_allowed: 0, job_location: 'Hyderabad (Gachibowli Campus)', drive_date: '2026-04-20', registration_deadline: '2026-12-31 23:59:59', drive_status: 'Ongoing' },
        { job_id: 'JOB-2025-AMZN-SDE', company_id: 'CMP-AMZN-07', officer_in_charge: 'TPO-EMP-101', job_title: 'Software Development Engineer - AWS Cloud', job_description: 'Building ultra-reliable distributed cloud primitives, scalable storage engines, and microservices.', job_role_type: 'Full-Time SDE', ctc_annual_lpa: 30.00, min_cgpa_cutoff: 8.00, max_backlogs_allowed: 0, job_location: 'Bangalore (WTC)', drive_date: '2026-04-28', registration_deadline: '2026-12-31 23:59:59', drive_status: 'Ongoing' },
        { job_id: 'JOB-2024-CSCO-NET', company_id: 'CMP-CSCO-03', officer_in_charge: 'TPO-EMP-104', job_title: 'Network Software & Automation Engineer', job_description: 'Building software-defined networking controllers, packet inspection engines, and security microservices.', job_role_type: 'Internship + Full-Time', ctc_annual_lpa: 18.00, min_cgpa_cutoff: 7.50, max_backlogs_allowed: 0, job_location: 'Bangalore (Cessna Business Park)', drive_date: '2026-05-02', registration_deadline: '2026-12-31 23:59:59', drive_status: 'Ongoing' },
        { job_id: 'JOB-2024-QCOM-HW', company_id: 'CMP-QCOM-04', officer_in_charge: 'TPO-EMP-104', job_title: 'Hardware & Modem Firmware Engineer', job_description: 'SoC validation, RTL synthesis, and high-speed memory controller firmware for 5G modem chips.', job_role_type: 'Full-Time SDE', ctc_annual_lpa: 22.00, min_cgpa_cutoff: 8.00, max_backlogs_allowed: 0, job_location: 'Bangalore & Chennai', drive_date: '2026-05-10', registration_deadline: '2026-12-31 23:59:59', drive_status: 'Ongoing' },
        { job_id: 'JOB-2024-TCS-DIGI', company_id: 'CMP-TCS-05', officer_in_charge: 'TPO-EMP-108', job_title: 'Assistant System Engineer (TCS Digital)', job_description: 'Enterprise application development across Java, Python, Angular, Cloud Migration, and Data Pipelines.', job_role_type: 'Full-Time SDE', ctc_annual_lpa: 7.50, min_cgpa_cutoff: 6.50, max_backlogs_allowed: 0, job_location: 'PAN India (Bangalore / Pune / Hyderabad)', drive_date: '2026-05-18', registration_deadline: '2026-12-31 23:59:59', drive_status: 'Ongoing' },
        { job_id: 'JOB-2024-LTTS-GET', company_id: 'CMP-LTTS-06', officer_in_charge: 'TPO-EMP-108', job_title: 'Graduate Engineer Trainee (GET) - Simulation & CAD', job_description: 'Structural FEA simulation, thermal dissipation modeling, and CAD component design for EV powertrains.', job_role_type: 'Core Engineering Trainee', ctc_annual_lpa: 6.50, min_cgpa_cutoff: 7.00, max_backlogs_allowed: 0, job_location: 'Mysore & Pune Engineering Centers', drive_date: '2026-05-25', registration_deadline: '2026-12-31 23:59:59', drive_status: 'Ongoing' }
    ],
    job_eligible_departments: [
        { job_id: 'JOB-2024-GOOG-SDE', department_id: 'DEPT-CSE' },
        { job_id: 'JOB-2024-GOOG-SDE', department_id: 'DEPT-ISE' },
        { job_id: 'JOB-2024-GOOG-SDE', department_id: 'DEPT-AIDS' },
        { job_id: 'JOB-2024-MSFT-SWE', department_id: 'DEPT-CSE' },
        { job_id: 'JOB-2024-MSFT-SWE', department_id: 'DEPT-ISE' },
        { job_id: 'JOB-2024-MSFT-SWE', department_id: 'DEPT-ECE' },
        { job_id: 'JOB-2024-MSFT-SWE', department_id: 'DEPT-AIDS' },
        { job_id: 'JOB-2025-AMZN-SDE', department_id: 'DEPT-CSE' },
        { job_id: 'JOB-2025-AMZN-SDE', department_id: 'DEPT-ISE' },
        { job_id: 'JOB-2025-AMZN-SDE', department_id: 'DEPT-AIDS' },
        { job_id: 'JOB-2025-AMZN-SDE', department_id: 'DEPT-ECE' },
        { job_id: 'JOB-2024-CSCO-NET', department_id: 'DEPT-CSE' },
        { job_id: 'JOB-2024-CSCO-NET', department_id: 'DEPT-ISE' },
        { job_id: 'JOB-2024-CSCO-NET', department_id: 'DEPT-ECE' },
        { job_id: 'JOB-2024-QCOM-HW', department_id: 'DEPT-ECE' },
        { job_id: 'JOB-2024-QCOM-HW', department_id: 'DEPT-CSE' },
        { job_id: 'JOB-2024-TCS-DIGI', department_id: 'DEPT-CSE' },
        { job_id: 'JOB-2024-TCS-DIGI', department_id: 'DEPT-ISE' },
        { job_id: 'JOB-2024-TCS-DIGI', department_id: 'DEPT-ECE' },
        { job_id: 'JOB-2024-TCS-DIGI', department_id: 'DEPT-MECH' },
        { job_id: 'JOB-2024-TCS-DIGI', department_id: 'DEPT-AIDS' },
        { job_id: 'JOB-2024-LTTS-GET', department_id: 'DEPT-MECH' }
    ],
    applications: [
        { application_id: 'APP-2024-0901', job_id: 'JOB-2024-GOOG-SDE', student_id: 'STU-2021-CS001', applied_at: '2024-09-05 10:15:00', current_status: 'Selected' },
        { application_id: 'APP-2024-0902', job_id: 'JOB-2024-GOOG-SDE', student_id: 'STU-2021-CS015', applied_at: '2024-09-05 11:30:00', current_status: 'Rejected' },
        { application_id: 'APP-2024-0903', job_id: 'JOB-2024-GOOG-SDE', student_id: 'STU-2021-AI010', applied_at: '2024-09-06 09:00:00', current_status: 'Rejected' },
        { application_id: 'APP-2024-0904', job_id: 'JOB-2024-MSFT-SWE', student_id: 'STU-2021-CS015', applied_at: '2024-09-12 14:20:00', current_status: 'Selected' },
        { application_id: 'APP-2024-0905', job_id: 'JOB-2024-MSFT-SWE', student_id: 'STU-2021-IS022', applied_at: '2024-09-12 15:45:00', current_status: 'Rejected' },
        { application_id: 'APP-2024-0906', job_id: 'JOB-2024-MSFT-SWE', student_id: 'STU-2021-AI010', applied_at: '2024-09-13 18:00:00', current_status: 'Selected' },
        { application_id: 'APP-2024-0907', job_id: 'JOB-2024-CSCO-NET', student_id: 'STU-2021-IS022', applied_at: '2024-09-25 10:00:00', current_status: 'Selected' },
        { application_id: 'APP-2024-0908', job_id: 'JOB-2024-CSCO-NET', student_id: 'STU-2021-EC012', applied_at: '2024-09-25 11:15:00', current_status: 'In-Process' },
        { application_id: 'APP-2024-0909', job_id: 'JOB-2024-QCOM-HW', student_id: 'STU-2021-EC045', applied_at: '2024-10-02 09:30:00', current_status: 'Selected' },
        { application_id: 'APP-2024-0910', job_id: 'JOB-2024-QCOM-HW', student_id: 'STU-2021-EC012', applied_at: '2024-10-02 10:45:00', current_status: 'Rejected' },
        { application_id: 'APP-2024-0911', job_id: 'JOB-2024-TCS-DIGI', student_id: 'STU-2021-ME030', applied_at: '2024-10-20 16:00:00', current_status: 'Applied' },
        { application_id: 'APP-2024-0912', job_id: 'JOB-2024-TCS-DIGI', student_id: 'STU-2021-EC012', applied_at: '2024-10-21 11:00:00', current_status: 'Shortlisted' },
        { application_id: 'APP-2024-0913', job_id: 'JOB-2024-LTTS-GET', student_id: 'STU-2021-ME030', applied_at: '2024-11-01 12:00:00', current_status: 'Rejected' },
        { application_id: 'APP-2024-0914', job_id: 'JOB-2024-LTTS-GET', student_id: 'STU-2021-ME018', applied_at: '2024-11-01 14:30:00', current_status: 'Selected' },
        { application_id: 'APP-2025-0101', job_id: 'JOB-2025-AMZN-SDE', student_id: 'STU-2021-CS001', applied_at: '2025-01-15 09:00:00', current_status: 'Selected' },
        { application_id: 'APP-2025-0102', job_id: 'JOB-2025-AMZN-SDE', student_id: 'STU-2021-CS015', applied_at: '2025-01-15 10:30:00', current_status: 'Shortlisted' },
        { application_id: 'APP-2025-0103', job_id: 'JOB-2025-AMZN-SDE', student_id: 'STU-2021-IS022', applied_at: '2025-01-16 14:00:00', current_status: 'Applied' }
    ],
    interview_rounds: [
        { round_id: 'RND-GOOG-01', job_id: 'JOB-2024-GOOG-SDE', round_sequence: 1, round_type: 'Online Coding Assessment (DSA & Graphs)', scheduled_timestamp: '2026-04-18 10:00:00', platform_or_venue: 'https://hackerrank.com/rvce-google-oa-2026' },
        { round_id: 'RND-GOOG-02', job_id: 'JOB-2024-GOOG-SDE', round_sequence: 2, round_type: 'Technical Round 1 (Trees & Dynamic Programming)', scheduled_timestamp: '2026-04-20 14:00:00', platform_or_venue: 'Google Meet Room - Alpha' },
        { round_id: 'RND-GOOG-03', job_id: 'JOB-2024-GOOG-SDE', round_sequence: 3, round_type: 'Technical Round 2 (System Architecture & Concurrency)', scheduled_timestamp: '2026-04-22 11:00:00', platform_or_venue: 'Google Meet Room - Beta' },
        { round_id: 'RND-GOOG-04', job_id: 'JOB-2024-GOOG-SDE', round_sequence: 4, round_type: 'Googleyness & Leadership Behavioral Interview', scheduled_timestamp: '2026-04-24 15:30:00', platform_or_venue: 'Google Meet Room - HR' },
        { round_id: 'RND-MSFT-01', job_id: 'JOB-2024-MSFT-SWE', round_sequence: 1, round_type: 'Online Diagnostic Coding Test', scheduled_timestamp: '2026-04-22 09:30:00', platform_or_venue: 'https://codility.com/msft-university-recruiting-2026' },
        { round_id: 'RND-MSFT-02', job_id: 'JOB-2024-MSFT-SWE', round_sequence: 2, round_type: 'Technical Interview 1 (OOPs & Multithreading)', scheduled_timestamp: '2026-04-24 10:00:00', platform_or_venue: 'MS Teams Conference Link 1' },
        { round_id: 'RND-MSFT-03', job_id: 'JOB-2024-MSFT-SWE', round_sequence: 3, round_type: 'Technical Interview 2 + Managerial Fitment', scheduled_timestamp: '2026-04-26 14:00:00', platform_or_venue: 'MS Teams Conference Link 2' },
        { round_id: 'RND-AMZN-01', job_id: 'JOB-2025-AMZN-SDE', round_sequence: 1, round_type: 'Online Coding Assessment (LeetCode Hard)', scheduled_timestamp: '2026-04-30 10:00:00', platform_or_venue: 'Amazon Chime Room 1' },
        { round_id: 'RND-CSCO-01', job_id: 'JOB-2024-CSCO-NET', round_sequence: 1, round_type: 'Online Technical & Networking Aptitude', scheduled_timestamp: '2026-05-04 10:00:00', platform_or_venue: 'Cisco Online Testing Portal' },
        { round_id: 'RND-CSCO-02', job_id: 'JOB-2024-CSCO-NET', round_sequence: 2, round_type: 'Technical Interview (TCP/IP & Socket Programming)', scheduled_timestamp: '2026-05-06 11:00:00', platform_or_venue: 'Webex Room 101' },
        { round_id: 'RND-QCOM-01', job_id: 'JOB-2024-QCOM-HW', round_sequence: 1, round_type: 'Hardware & Embedded C Aptitude Assessment', scheduled_timestamp: '2026-05-12 10:00:00', platform_or_venue: 'ECE VLSI Computer Lab 3' },
        { round_id: 'RND-QCOM-02', job_id: 'JOB-2024-QCOM-HW', round_sequence: 2, round_type: 'Core Technical Interview (RTL & Microcontrollers)', scheduled_timestamp: '2026-05-14 11:30:00', platform_or_venue: 'Placement Cell Boardroom 1' },
        { round_id: 'RND-TCS-01', job_id: 'JOB-2024-TCS-DIGI', round_sequence: 1, round_type: 'National Qualifier Test (NQT) & Coding', scheduled_timestamp: '2026-05-20 10:00:00', platform_or_venue: 'TCS iON Digital Zone' },
        { round_id: 'RND-LTTS-01', job_id: 'JOB-2024-LTTS-GET', round_sequence: 1, round_type: 'Core Mechanical Aptitude & Thermodynamics Test', scheduled_timestamp: '2026-05-26 10:00:00', platform_or_venue: 'Mechanical Seminar Hall' },
        { round_id: 'RND-LTTS-02', job_id: 'JOB-2024-LTTS-GET', round_sequence: 2, round_type: 'Technical & Personal Domain Interview', scheduled_timestamp: '2026-05-28 11:00:00', platform_or_venue: 'Placement Cell Boardroom 2' }
    ],
    round_results: [
        { result_id: 'RES-2024-101', round_id: 'RND-GOOG-01', student_id: 'STU-2021-CS001', round_status: 'Qualified', evaluation_score: 98.00, interviewer_remarks: 'Solved both 2 LeetCode Hard graph problems in 42 mins with O(V+E) time.' },
        { result_id: 'RES-2024-102', round_id: 'RND-GOOG-01', student_id: 'STU-2021-CS015', round_status: 'Qualified', evaluation_score: 85.00, interviewer_remarks: 'Solved 1.5 questions. Good approach.' },
        { result_id: 'RES-2024-103', round_id: 'RND-GOOG-01', student_id: 'STU-2021-AI010', round_status: 'Qualified', evaluation_score: 90.00, interviewer_remarks: 'Solid algorithmic thinking.' },
        { result_id: 'RES-2024-104', round_id: 'RND-GOOG-02', student_id: 'STU-2021-CS001', round_status: 'Qualified', evaluation_score: 95.00, interviewer_remarks: 'Flawless binary tree and topological sort implementation.' },
        { result_id: 'RES-2024-105', round_id: 'RND-GOOG-02', student_id: 'STU-2021-CS015', round_status: 'Disqualified', evaluation_score: 60.00, interviewer_remarks: 'Struggled with complex dynamic programming state transitions.' },
        { result_id: 'RES-2024-106', round_id: 'RND-GOOG-02', student_id: 'STU-2021-AI010', round_status: 'Disqualified', evaluation_score: 65.00, interviewer_remarks: 'Average space complexity optimization.' },
        { result_id: 'RES-2024-107', round_id: 'RND-GOOG-03', student_id: 'STU-2021-CS001', round_status: 'Qualified', evaluation_score: 92.00, interviewer_remarks: 'Strong understanding of distributed key-value store architecture & caching.' },
        { result_id: 'RES-2024-108', round_id: 'RND-GOOG-04', student_id: 'STU-2021-CS001', round_status: 'Qualified', evaluation_score: 94.00, interviewer_remarks: 'Excellent team player mindset and communication. Strongly recommended for hire.' },
        { result_id: 'RES-2024-201', round_id: 'RND-MSFT-01', student_id: 'STU-2021-CS015', round_status: 'Qualified', evaluation_score: 92.00, interviewer_remarks: 'All edge cases and memory constraints passed.' },
        { result_id: 'RES-2024-202', round_id: 'RND-MSFT-01', student_id: 'STU-2021-IS022', round_status: 'Disqualified', evaluation_score: 58.00, interviewer_remarks: 'Failed concurrency and performance test cases.' },
        { result_id: 'RES-2024-203', round_id: 'RND-MSFT-01', student_id: 'STU-2021-AI010', round_status: 'Qualified', evaluation_score: 95.00, interviewer_remarks: 'Clean, modular, and optimized solution.' },
        { result_id: 'RES-2024-204', round_id: 'RND-MSFT-02', student_id: 'STU-2021-CS015', round_status: 'Qualified', evaluation_score: 88.00, interviewer_remarks: 'Deep knowledge of Java virtual thread concurrency & garbage collection.' },
        { result_id: 'RES-2024-205', round_id: 'RND-MSFT-02', student_id: 'STU-2021-AI010', round_status: 'Qualified', evaluation_score: 90.00, interviewer_remarks: 'Demonstrated high aptitude in system kernels and ML pipeline integration.' },
        { result_id: 'RES-2024-206', round_id: 'RND-MSFT-03', student_id: 'STU-2021-CS015', round_status: 'Qualified', evaluation_score: 86.00, interviewer_remarks: 'Positive attitude, recommended for Azure Cloud Storage team.' },
        { result_id: 'RES-2024-207', round_id: 'RND-MSFT-03', student_id: 'STU-2021-AI010', round_status: 'Qualified', evaluation_score: 93.00, interviewer_remarks: 'Exceptional candidate, assigned to Azure Copilot R&D team.' },
        { result_id: 'RES-2024-301', round_id: 'RND-CSCO-01', student_id: 'STU-2021-IS022', round_status: 'Qualified', evaluation_score: 84.00, interviewer_remarks: 'Great score in network protocols and IP routing logic.' },
        { result_id: 'RES-2024-302', round_id: 'RND-CSCO-02', student_id: 'STU-2021-IS022', round_status: 'Qualified', evaluation_score: 88.00, interviewer_remarks: 'Clean socket server implementation using C++ and Python.' },
        { result_id: 'RES-2024-401', round_id: 'RND-QCOM-01', student_id: 'STU-2021-EC045', round_status: 'Qualified', evaluation_score: 94.00, interviewer_remarks: 'Highest score in digital logic synthesis and C.' },
        { result_id: 'RES-2024-402', round_id: 'RND-QCOM-01', student_id: 'STU-2021-EC012', round_status: 'Disqualified', evaluation_score: 64.00, interviewer_remarks: 'Scored below cutoff in Verilog test section.' },
        { result_id: 'RES-2024-403', round_id: 'RND-QCOM-02', student_id: 'STU-2021-EC045', round_status: 'Qualified', evaluation_score: 92.00, interviewer_remarks: 'Strong RTL state machine design and SPI/I2C protocol fundamentals.' },
        { result_id: 'RES-2024-501', round_id: 'RND-LTTS-01', student_id: 'STU-2021-ME030', round_status: 'Disqualified', evaluation_score: 55.00, interviewer_remarks: 'Did not clear the quantitative aptitude cutoff.' },
        { result_id: 'RES-2024-502', round_id: 'RND-LTTS-01', student_id: 'STU-2021-ME018', round_status: 'Qualified', evaluation_score: 89.00, interviewer_remarks: 'Excellent grasp on thermodynamics, fluid mechanics, and CAD.' },
        { result_id: 'RES-2024-503', round_id: 'RND-LTTS-02', student_id: 'STU-2021-ME018', round_status: 'Qualified', evaluation_score: 86.00, interviewer_remarks: 'Practical knowledge in ANSYS simulations demonstrated during project defense.' }
    ],
    placement_offers: [
        { offer_id: 'OFFR-2024-GOOG-01', application_id: 'APP-2024-0901', student_id: 'STU-2021-CS001', company_id: 'CMP-GOOG-01', job_id: 'JOB-2024-GOOG-SDE', offered_ctc_lpa: 32.50, base_salary_lpa: 18.00, joining_bonus_lpa: 5.00, offer_issued_date: '2024-09-20', tentative_joining_date: '2025-07-15', offer_status: 'Accepted' },
        { offer_id: 'OFFR-2025-AMZN-01', application_id: 'APP-2025-0101', student_id: 'STU-2021-CS001', company_id: 'CMP-AMZN-07', job_id: 'JOB-2025-AMZN-SDE', offered_ctc_lpa: 30.00, base_salary_lpa: 17.50, joining_bonus_lpa: 4.00, offer_issued_date: '2025-02-01', tentative_joining_date: '2025-08-01', offer_status: 'Offered' },
        { offer_id: 'OFFR-2024-MSFT-01', application_id: 'APP-2024-0904', student_id: 'STU-2021-CS015', company_id: 'CMP-MSFT-02', job_id: 'JOB-2024-MSFT-SWE', offered_ctc_lpa: 28.00, base_salary_lpa: 16.50, joining_bonus_lpa: 3.50, offer_issued_date: '2024-09-28', tentative_joining_date: '2025-08-01', offer_status: 'Accepted' },
        { offer_id: 'OFFR-2024-MSFT-02', application_id: 'APP-2024-0906', student_id: 'STU-2021-AI010', company_id: 'CMP-MSFT-02', job_id: 'JOB-2024-MSFT-SWE', offered_ctc_lpa: 28.00, base_salary_lpa: 16.50, joining_bonus_lpa: 3.50, offer_issued_date: '2024-09-28', tentative_joining_date: '2025-08-01', offer_status: 'Accepted' },
        { offer_id: 'OFFR-2024-CSCO-01', application_id: 'APP-2024-0907', student_id: 'STU-2021-IS022', company_id: 'CMP-CSCO-03', job_id: 'JOB-2024-CSCO-NET', offered_ctc_lpa: 18.00, base_salary_lpa: 12.00, joining_bonus_lpa: 2.00, offer_issued_date: '2024-10-10', tentative_joining_date: '2025-07-01', offer_status: 'Accepted' },
        { offer_id: 'OFFR-2024-QCOM-01', application_id: 'APP-2024-0909', student_id: 'STU-2021-EC045', company_id: 'CMP-QCOM-04', job_id: 'JOB-2024-QCOM-HW', offered_ctc_lpa: 22.00, base_salary_lpa: 14.00, joining_bonus_lpa: 3.00, offer_issued_date: '2024-10-22', tentative_joining_date: '2025-07-20', offer_status: 'Accepted' },
        { offer_id: 'OFFR-2024-TCS-01', application_id: 'APP-2024-0912', student_id: 'STU-2021-EC012', company_id: 'CMP-TCS-05', job_id: 'JOB-2024-TCS-DIGI', offered_ctc_lpa: 7.50, base_salary_lpa: 5.50, joining_bonus_lpa: 0.50, offer_issued_date: '2024-11-10', tentative_joining_date: '2025-09-01', offer_status: 'Offered' },
        { offer_id: 'OFFR-2024-LTTS-01', application_id: 'APP-2024-0914', student_id: 'STU-2021-ME018', company_id: 'CMP-LTTS-06', job_id: 'JOB-2024-LTTS-GET', offered_ctc_lpa: 6.50, base_salary_lpa: 5.20, joining_bonus_lpa: 0.50, offer_issued_date: '2024-11-20', tentative_joining_date: '2025-08-10', offer_status: 'Accepted' }
    ],
    placement_offer_audit_log: [
        { log_id: 1, offer_id: 'OFFR-2024-CSCO-01', student_id: 'STU-2021-IS022', old_ctc_lpa: 17.00, new_ctc_lpa: 18.00, old_status: 'Offered', new_status: 'Accepted', action_type: 'UPDATE', changed_at: '2024-10-10 14:22:00', changed_by: 'root@localhost' },
        { log_id: 2, offer_id: 'OFFR-2024-GOOG-01', student_id: 'STU-2021-CS001', old_ctc_lpa: 30.00, new_ctc_lpa: 32.50, old_status: 'Offered', new_status: 'Accepted', action_type: 'UPDATE', changed_at: '2024-09-20 18:30:15', changed_by: 'root@localhost' },
        { log_id: 3, offer_id: 'OFFR-2024-MSFT-01', student_id: 'STU-2021-CS015', old_ctc_lpa: 28.00, new_ctc_lpa: 28.00, old_status: 'Offered', new_status: 'Accepted', action_type: 'UPDATE', changed_at: '2024-09-28 11:10:00', changed_by: 'root@localhost' }
    ]
};

async function initDB() {
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'college_placement_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            multipleStatements: true
        });

        // Test connection
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        
        isConnected = true;
        connectionError = null;
        console.log(`[Database] Successfully connected to MySQL at ${process.env.DB_HOST}:${process.env.DB_PORT} (DB: ${process.env.DB_NAME})`);
    } catch (err) {
        isConnected = false;
        connectionError = err.message;
        console.warn(`[Database] MySQL not reachable (${err.message}). Activating High-Fidelity In-Memory Fallback.`);
    }
}

// Unified Query Handler
async function query(sql, params = []) {
    if (isConnected && pool) {
        try {
            const [rows] = await pool.query(sql, params);
            return rows;
        } catch (dbErr) {
            // Re-throw DB error so UI can display trigger or constraint violations
            throw dbErr;
        }
    } else {
        // Handle queries in Mock Mode
        return handleMockQuery(sql, params);
    }
}

function handleMockQuery(sql, params) {
    const trimmed = sql.trim().toLowerCase();
    
    // Simple mock router for common queries
    if (trimmed.startsWith('select')) {
        return mockData;
    }
    return { affectedRows: 1, insertId: 1 };
}

function getStatus() {
    return {
        isConnected,
        connectionError,
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'college_placement_db',
        mode: isConnected ? 'MySQL Live Engine' : 'High-Fidelity Mock Mode'
    };
}

module.exports = {
    initDB,
    query,
    getStatus,
    mockData,
    get isLive() { return isConnected; }
};
