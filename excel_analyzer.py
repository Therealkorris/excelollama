import warnings
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=DeprecationWarning)

from langchain_community.llms import Ollama
from langchain.callbacks import StreamingStdOutCallbackHandler
from langchain.memory import ConversationBufferMemory
import pandas as pd
import sqlite3
import sys
import os
import re

# Hardcoded path to your Excel file
EXCEL_FILE = "tibia_market_data.xlsx"  # Update this to your Excel file name

def setup_database(file_path: str):
    """Set up SQLite database from Excel file"""
    # Read Excel file
    df = pd.read_excel(file_path)
    
    # Clean column names (replace spaces with underscores)
    df.columns = [col.lower().replace(' ', '_') for col in df.columns]
    
    # Convert date columns if they exist
    date_columns = df.select_dtypes(include=['object']).columns
    for col in date_columns:
        try:
            df[col] = pd.to_datetime(df[col])
        except:
            continue
    
    # Create SQLite database
    conn = sqlite3.connect(':memory:')  # Use in-memory database
    df.to_sql('excel_data', conn, index=False)
    return conn, df

def sql_query(conn, query: str):
    """Execute SQL query and return results"""
    try:
        return pd.read_sql_query(query, conn).to_dict(orient='records')
    except Exception as e:
        return f"Error executing query: {str(e)}"

def extract_sql_query(text: str) -> str:
    """Extract SQL query from text, handling both markdown and plain SQL formats."""
    # Try to find SQL query in markdown format
    sql_pattern = r"```sql\n(.*?)\n```"
    matches = re.findall(sql_pattern, text, re.DOTALL)
    
    if matches:
        return matches[0].strip()
    
    # If no markdown SQL found, try to find a SELECT statement
    select_pattern = r"SELECT.*?;"
    matches = re.findall(select_pattern, text, re.DOTALL | re.IGNORECASE)
    
    if matches:
        return matches[0].strip()
        
    # If still no match, return the original text
    return text.strip()

def analyze_excel(file_path: str):
    # Validate file path
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found")
        return
    
    if not file_path.endswith(('.xlsx', '.xls', '.csv')):
        print("Error: File must be an Excel file (.xlsx, .xls) or CSV file (.csv)")
        return

    # Initialize database
    print("\nLoading and processing file...")
    try:
        conn, df = setup_database(file_path)
    except Exception as e:
        print(f"Error setting up database: {str(e)}")
        return
        
    # Initialize Ollama
    print("\nInitializing AI model...")
    try:
        llm = Ollama(
            model="mistral",
            callbacks=[StreamingStdOutCallbackHandler()],
            temperature=0.1
        )
    except Exception as e:
        print(f"Error initializing AI model: {str(e)}")
        return
    
    # Create system prompt with schema information
    columns_info = ", ".join(f"{col} ({df[col].dtype})" for col in df.columns)
    system_prompt = f"""You are an SQL expert. Generate ONLY the SQL query needed to answer the question.
    
    IMPORTANT DATABASE DETAILS:
    - There is only ONE table named 'excel_data'
    - The table has EXACTLY these columns (case sensitive): {columns_info}
    - Column names must match EXACTLY as shown above
    - Do not reference any other tables or columns that don't exist
    - All queries must use only the 'excel_data' table
    
    QUERY RULES:
    1. Return ONLY the SQL query, nothing else
    2. Do not include any explanations
    3. Do not use markdown formatting
    4. End the query with a semicolon
    5. Use only valid SQLite syntax
    6. Only reference columns that exist in the schema above
    7. Never use JOIN since there is only one table
    8. Column names are case sensitive
    9. String comparisons should be case insensitive (use LOWER())
    
    Example valid queries:
    SELECT item_name, npc_sell_name, npc_sell_price FROM excel_data WHERE LOWER(item_name) LIKE LOWER('%sword%');
    SELECT npc_sell_location FROM excel_data WHERE LOWER(item_name) = LOWER('stone skin amulet');
    """
    
    print("\nFile loaded successfully!")
    print(f"Rows: {len(df)}")
    print(f"Columns: {', '.join(df.columns)}")
    
    print("\n=== Excel Analysis Session ===")
    print("- Type your questions about the data")
    print("- Type 'schema' to see the data structure")
    print("- Type 'exit' to quit")
    print("- Type 'help' for example questions")
    
    while True:
        question = input("\nQuestion: ").strip()
        
        if question.lower() == 'exit':
            print("\nEnding analysis session. Goodbye!")
            break
            
        if question.lower() == 'schema':
            print("\nTable Schema:")
            print(columns_info)
            continue
            
        if question.lower() == 'help':
            print("\nExample questions:")
            print("- What is the npc_sell_location for stone skin amulet?")
            print("- What is the npc_sell_price for stone skin amulet?")
            print("- Show me items with npc_sell_price over 1000")
            print("- What are the top 5 most expensive items by npc_sell_price?")
            print("- Find all items sold in Ashta'daramai")
            continue
            
        if not question:
            continue
            
        try:
            # Generate SQL query using LLM
            prompt = f"""Write a SQL query to answer: {question}
            Remember:
            1. Use ONLY the excel_data table
            2. Use EXACT column names: {', '.join(df.columns)}
            3. Use LOWER() for case-insensitive string comparisons
            """
            response = llm.invoke(prompt)
            
            # Extract just the SQL query
            query = extract_sql_query(response)
            print("\nExecuting query:", query)
            
            # Execute the query
            results = sql_query(conn, query)
            
            # Format and display results
            if isinstance(results, list):
                if not results:
                    print("No results found")
                else:
                    print("\nResults:")
                    for row in results[:5]:  # Show first 5 results
                        print(row)
                    if len(results) > 5:
                        print(f"... and {len(results)-5} more rows")
            else:
                print(results)  # Print error message if query failed
                
        except Exception as e:
            print(f"\nError: {str(e)}")
            print("Try rephrasing your question or type 'help' for examples.")

if __name__ == "__main__":
    # Use the hardcoded file path instead of command line argument
    analyze_excel(EXCEL_FILE) 