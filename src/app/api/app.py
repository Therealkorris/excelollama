# from fastapi import FastAPI, UploadFile, File, HTTPException, Query
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import RedirectResponse, JSONResponse
# from pandasai import SmartDataframe
# from pandasai.skills import skill
# from langchain_community.llms import Ollama
# import pandas as pd
# import numpy as np
# import matplotlib.pyplot as plt
# from typing import Dict, Optional
# import io
# import tempfile
# import os

# app = FastAPI(title="Data Analysis API")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:3000"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Global variables
# current_df: Optional[pd.DataFrame] = None
# smart_df: Optional[SmartDataframe] = None
# llm = None
# temp_file_path: Optional[str] = None

# # Custom skills
# @skill
# def find_highest_value(df: pd.DataFrame, column_name: str) -> Dict:
#     """
#     Find the row with the highest value in the specified column
#     Args:
#         df (pd.DataFrame): The dataframe to analyze
#         column_name (str): The column to find the highest value in
#     Returns:
#         Dict: Dictionary containing the row with the highest value
#     """
#     if column_name not in df.columns:
#         return {"error": f"Column {column_name} not found"}
    
#     highest_row = df.loc[df[column_name].idxmax()]
#     return highest_row.to_dict()

# @skill
# def plot_column_distribution(df: pd.DataFrame, column_name: str) -> str:
#     """
#     Create a bar plot showing the distribution of values in a column
#     Args:
#         df (pd.DataFrame): The dataframe to analyze
#         column_name (str): The column to plot
#     Returns:
#         str: Path to the saved plot
#     """
#     plt.figure(figsize=(10, 6))
#     df[column_name].value_counts().plot(kind='bar')
#     plt.title(f'Distribution of {column_name}')
#     plt.xlabel(column_name)
#     plt.ylabel('Count')
    
#     # Save plot
#     plot_path = "./tmp/plots/distribution.png"
#     os.makedirs(os.path.dirname(plot_path), exist_ok=True)
#     plt.savefig(plot_path)
#     plt.close()
    
#     return plot_path

# @app.post("/api/init-model")
# async def init_model(model_name: str = Query(..., description="Name of the model to use")):
#     global llm
#     try:
#         llm = Ollama(
#             base_url="http://localhost:11434",
#             model=model_name
#         )
#         return {"status": "success", "message": f"Model {model_name} initialized successfully"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to initialize model: {str(e)}")

# @app.post("/api/load-file")
# async def load_file(file: UploadFile = File(...)):
#     global current_df, smart_df, llm, temp_file_path
    
#     if not llm:
#         raise HTTPException(status_code=400, detail="Please initialize a model first")
    
#     try:
#         # Create a temporary file
#         suffix = os.path.splitext(file.filename)[1] if file.filename else '.xlsx'
#         with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
#             contents = await file.read()
#             tmp.write(contents)
#             temp_file_path = tmp.name

#         # Read the Excel file
#         try:
#             current_df = pd.read_excel(temp_file_path)
#             print(f"Successfully read DataFrame with shape: {current_df.shape}")
#         except Exception as e:
#             os.unlink(temp_file_path)
#             raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")
        
#         try:
#             # Create SmartDataframe with custom configuration
#             smart_df = SmartDataframe(
#                 current_df,
#                 config={
#                     "llm": llm,
#                     "verbose": True,
#                     "custom_whitelisted_dependencies": ["matplotlib", "seaborn", "numpy"],
#                     "save_charts": True,
#                     "save_charts_path": "./tmp/plots"
#                 }
#             )
#             print("Successfully created SmartDataframe")
            
#             # Add custom skills
#             smart_df.add_skills([find_highest_value, plot_column_distribution])
#             print("Successfully added custom skills")
            
#             # Verify SmartDataframe is working
#             test_result = smart_df.chat("What are the column names?")
#             print(f"Test query result: {test_result}")
            
#             return {
#                 "status": "success",
#                 "message": f"Successfully loaded file with {len(current_df)} rows and {len(current_df.columns)} columns",
#                 "metadata": {
#                     "rows": len(current_df),
#                     "columns": current_df.columns.tolist(),
#                     "dtypes": {col: str(dtype) for col, dtype in current_df.dtypes.items()}
#                 }
#             }
#         except Exception as e:
#             print(f"Error initializing SmartDataframe: {str(e)}")
#             raise HTTPException(status_code=500, detail=f"Error initializing analysis engine: {str(e)}")
            
#     except Exception as e:
#         if temp_file_path and os.path.exists(temp_file_path):
#             os.unlink(temp_file_path)
#         print(f"Error in file loading: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error loading file: {str(e)}")

# @app.post("/api/analyze")
# async def analyze(query: Dict[str, str]):
#     global smart_df, current_df
    
#     if current_df is None or smart_df is None:
#         raise HTTPException(status_code=400, detail="No data loaded. Please upload a file first.")
    
#     if not query.get("text"):
#         raise HTTPException(status_code=400, detail="Query text is required")
    
#     try:
#         text = query["text"].lower()
        
#         # Handle direct value lookups
#         if "what is" in text and "for" in text:
#             try:
#                 # Extract the column and value to search for
#                 parts = text.split("for")
#                 search_value = parts[1].strip()
#                 column_name = parts[0].replace("what is", "").strip()
                
#                 # Find the row
#                 mask = current_df.apply(lambda x: x.astype(str).str.lower() == search_value.lower() if x.dtype == object else False)
#                 if mask.any().any():
#                     # Get the row where we found the match
#                     row = current_df[mask.any(axis=1)].iloc[0]
#                     # Get the requested value
#                     result = str(row[column_name])
#                     return {"result": result, "type": "text"}
#             except Exception as e:
#                 print(f"Direct lookup failed: {e}")
#                 # Fall back to PandasAI if direct lookup fails
#                 pass
        
#         # Use PandasAI for the query
#         raw_result = smart_df.chat(text)
        
#         # Convert any type of result to a proper response
#         if isinstance(raw_result, (list, tuple, np.ndarray)):
#             result = str(raw_result[0]) if len(raw_result) > 0 else "No result found"
#         elif isinstance(raw_result, pd.DataFrame):
#             result = raw_result.to_string() if not raw_result.empty else "No result found"
#         elif isinstance(raw_result, pd.Series):
#             result = raw_result.to_string() if not raw_result.empty else "No result found"
#         else:
#             result = str(raw_result)
            
#         return {"result": result, "type": "text"}
            
#     except Exception as e:
#         print(f"Analysis error: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

# @app.get("/api/file-info")
# async def get_file_info():
#     global current_df
#     if current_df is None:
#         raise HTTPException(status_code=400, detail="No file loaded")
    
#     return {
#         "rows": len(current_df),
#         "columns": current_df.columns.tolist(),
#         "preview": current_df.head(5).values.tolist(),
#         "dtypes": {col: str(dtype) for col, dtype in current_df.dtypes.items()}
#     }

# @app.get("/api/health")
# async def health_check():
#     global current_df, smart_df, llm
#     return {
#         "status": "running",
#         "model_loaded": llm is not None,
#         "data_loaded": current_df is not None and smart_df is not None,
#         "model_name": getattr(llm, "model", "unknown") if llm else None,
#         "data_shape": current_df.shape if current_df is not None else None
#     }

# @app.on_event("shutdown")
# async def cleanup():
#     global temp_file_path
#     if temp_file_path and os.path.exists(temp_file_path):
#         os.unlink(temp_file_path)

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True) 