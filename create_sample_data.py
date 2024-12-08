import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Create sample data
np.random.seed(42)  # For reproducible results

# Number of records
n_records = 100

# Generate sample data
data = {
    'Employee_ID': range(1001, 1001 + n_records),
    'First_Name': [f'Employee{i}' for i in range(1, n_records + 1)],
    'Last_Name': [f'Surname{i}' for i in range(1, n_records + 1)],
    'Department': np.random.choice(['Sales', 'IT', 'HR', 'Marketing', 'Finance'], n_records),
    'Salary': np.random.randint(30000, 120000, n_records),
    'Join_Date': [(datetime.now() - timedelta(days=np.random.randint(0, 3650))) for _ in range(n_records)],
    'Performance_Score': np.random.randint(1, 6, n_records),
    'Years_Experience': np.random.randint(0, 25, n_records)
}

# Create DataFrame
df = pd.DataFrame(data)

# Save to Excel
df.to_excel('data.xlsx', index=False)
print("Sample Excel file 'data.xlsx' has been created successfully!")
print("\nSample data structure:")
print(df.head()) 