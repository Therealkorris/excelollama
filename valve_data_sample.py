import pandas as pd
import random
from datetime import datetime, timedelta

# Templates for natural text descriptions
templates = [
    "Just received a {valve_type} valve from {manufacturer}. The model number is {serial_id}. {material} construction makes it perfect for high-pressure applications up to {pressure_rating}. {extra}",
    "Checking inventory: Found a {material} {valve_type} valve (ID: {serial_id}) in warehouse B. Dimensions are roughly {width} inches wide by {height} inches tall. {extra}",
    "Customer inquiry about {manufacturer}'s {valve_type} valve, {serial_id}. They're particularly interested in its {pressure_rating} rating. {extra}",
    "Maintenance report: The {valve_type} valve ({serial_id}) from {manufacturer} needs inspection. It's a {material} unit rated for {pressure_rating}. {extra}",
    "New shipment arrived: {manufacturer} {valve_type} valves. Serial {serial_id} included. Made of {material}, these units measure {width}\" x {height}\". {extra}",
]

extra_details = [
    "Recommended for chemical processing applications.",
    "Perfect for water treatment facilities.",
    "Commonly used in oil and gas industry.",
    "Ideal for high-temperature operations.",
    "Suitable for corrosive environments.",
]

# Random notes and comments for noise
random_notes = [
    "Meeting scheduled with supplier next week",
    "Need to follow up with customer about delivery",
    "Warehouse inventory check completed",
    "Quality control inspection passed",
    "Maintenance schedule updated",
    "Order pending approval",
    "Shipping delayed due to weather",
    "Customer feedback received",
    "Training session scheduled",
    "Documentation needs update"
]

# Generate messy data
num_samples = 100
raw_data = []
start_date = datetime(2023, 1, 1)

for i in range(num_samples):
    row = {}
    
    # Add random date
    row['entry_date'] = (start_date + timedelta(days=random.randint(0, 365))).strftime('%Y-%m-%d')
    
    # Add random ID
    row['entry_id'] = f"LOG_{random.randint(1000, 9999)}"
    
    # Add random department
    row['department'] = random.choice(['Inventory', 'Maintenance', 'Sales', 'Quality Control', 'Shipping'])
    
    # Add random priority
    row['priority'] = random.choice(['Low', 'Medium', 'High', 'Urgent'])
    
    # Add random status
    row['status'] = random.choice(['Pending', 'In Progress', 'Completed', 'On Hold'])
    
    # Decide if this row contains valve information (70% chance)
    if random.random() < 0.7:
        # Generate valve data
        valve_type = random.choice(['butterfly', 'gate', 'check', 'ball', 'globe', 'control'])
        manufacturer = random.choice(['ValveTech', 'ValveTech Industries', 'FlowControl Inc', 'FlowMaster', 'ValveWorks', 'PrecisionFlow Systems'])
        material = random.choice(['Stainless Steel 316', 'Carbon Steel', 'Bronze', 'Stainless Steel 304', 'Cast Iron', 'Titanium'])
        
        prefix = {'butterfly': 'BF', 'gate': 'GV', 'check': 'CV', 'ball': 'BV', 'globe': 'GB', 'control': 'CT'}
        serial_id = f"{prefix[valve_type]}-{random.randint(2020,2024)}-{random.choice(['A','B','C','X','Y','Z'])}{random.randint(100,999)}"
        
        width = round(random.uniform(4.0, 15.0), 1)
        height = round(random.uniform(3.0, 16.0), 1)
        pressure = random.choice([75, 150, 250, 300, 500, 750, 1000])
        pressure_rating = f"{pressure} PSI"
        
        # Create description
        template = random.choice(templates)
        extra = random.choice(extra_details)
        description = template.format(
            valve_type=valve_type,
            manufacturer=manufacturer,
            serial_id=serial_id,
            material=material,
            width=width,
            height=height,
            pressure_rating=pressure_rating,
            extra=extra
        )
    else:
        # Add random note instead of valve information
        description = random.choice(random_notes)
    
    # Add notes/description to random column name
    note_column = random.choice(['notes', 'description', 'comments', 'details', 'log_entry'])
    row[note_column] = description
    
    # Add random additional columns
    row['last_modified_by'] = f"USER_{random.randint(100, 999)}"
    row['location'] = random.choice(['Warehouse A', 'Warehouse B', 'Main Office', 'Production Floor', 'Quality Lab'])
    row['follow_up'] = random.choice(['Yes', 'No', 'N/A'])
    
    raw_data.append(row)

# Create DataFrame with randomly ordered columns
df = pd.DataFrame(raw_data)
columns = list(df.columns)
random.shuffle(columns)
df = df[columns]

# Save to Excel
df.to_excel('messy_valve_data.xlsx', index=False)

print("Generated 'messy_valve_data.xlsx' with unstructured data")
print("- Contains mix of valve descriptions and random notes")
print("- Random column ordering")
print("- Multiple possible column names for descriptions")
print("- Added noise and irrelevant information") 