import sys
import json
from datetime import datetime
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QPushButton, QTextEdit, QLabel, 
                            QFileDialog, QComboBox, QMessageBox, QTreeWidget,
                            QTreeWidgetItem, QStackedWidget, QProgressBar)
from PyQt6.QtCore import Qt
import pandas as pd
import ollama
import requests
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, TypedDict
from langgraph.graph import Graph, StateGraph
from langgraph.prebuilt import ToolExecutor
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.messages.base import BaseMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 2000  # Characters per chunk
CHUNK_OVERLAP = 200  # Overlap between chunks

class ProcessingState(TypedDict):
    messages: List[Dict[str, str]]
    current_chunk: str
    chunks_processed: int
    total_chunks: int
    extracted_valves: List[Dict[str, Any]]

class ValveSpecification(BaseModel):
    valve_type: str
    serial_id: str
    width: float | None
    height: float | None
    pressure_rating: str | None
    material: str | None
    manufacturer: str | None

class ValveList(BaseModel):
    valves: List[ValveSpecification]

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Valve Specification Extractor")
        self.setMinimumSize(1200, 800)
        self.current_df = None
        
        # Initialize text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
        )
        
        # Setup the graph for processing
        self.setup_processing_graph()
        
        # Main widget and layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QHBoxLayout(main_widget)
        
        # Left panel for input
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        
        # Model selection
        model_layout = QHBoxLayout()
        model_label = QLabel("Select Model:")
        self.model_combo = QComboBox()
        self.refresh_models_btn = QPushButton("Refresh")
        model_layout.addWidget(model_label)
        model_layout.addWidget(self.model_combo)
        model_layout.addWidget(self.refresh_models_btn)
        left_layout.addLayout(model_layout)
        
        # Stacked widget for input types
        self.input_stack = QStackedWidget()
        
        # Text input
        self.input_text = QTextEdit()
        self.input_stack.addWidget(self.input_text)
        
        # Excel TreeView
        self.tree_widget = QTreeWidget()
        self.tree_widget.setAlternatingRowColors(True)
        self.tree_widget.setRootIsDecorated(False)
        self.tree_widget.setUniformRowHeights(True)
        self.tree_widget.setSelectionBehavior(QTreeWidget.SelectionBehavior.SelectRows)
        self.tree_widget.setSelectionMode(QTreeWidget.SelectionMode.ExtendedSelection)
        self.input_stack.addWidget(self.tree_widget)
        
        left_layout.addWidget(self.input_stack)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        left_layout.addWidget(self.progress_bar)
        
        # Buttons
        button_layout = QHBoxLayout()
        self.load_file_btn = QPushButton("Load File")
        self.process_btn = QPushButton("Process")
        self.clear_btn = QPushButton("Clear")
        button_layout.addWidget(self.load_file_btn)
        button_layout.addWidget(self.process_btn)
        button_layout.addWidget(self.clear_btn)
        left_layout.addLayout(button_layout)
        
        # Right panel for output
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        
        # Chat/Response area
        self.chat_label = QLabel("Chat Response:")
        self.chat_text = QTextEdit()
        self.chat_text.setReadOnly(True)
        right_layout.addWidget(self.chat_label)
        right_layout.addWidget(self.chat_text)
        
        # Structured Output area
        self.output_label = QLabel("Extracted Specifications:")
        self.output_text = QTextEdit()
        self.output_text.setReadOnly(True)
        right_layout.addWidget(self.output_label)
        right_layout.addWidget(self.output_text)
        
        # Save buttons
        save_layout = QHBoxLayout()
        self.save_json_btn = QPushButton("Save as JSON")
        self.save_excel_btn = QPushButton("Save as Excel")
        save_layout.addWidget(self.save_json_btn)
        save_layout.addWidget(self.save_excel_btn)
        right_layout.addLayout(save_layout)
        
        # Add panels to main layout
        layout.addWidget(left_panel)
        layout.addWidget(right_panel)
        
        # Connect signals
        self.load_file_btn.clicked.connect(self.load_file)
        self.process_btn.clicked.connect(self.process_text)
        self.clear_btn.clicked.connect(self.clear_all)
        self.save_json_btn.clicked.connect(self.save_json)
        self.save_excel_btn.clicked.connect(self.save_excel)
        self.refresh_models_btn.clicked.connect(self.refresh_models)
        
        # Initialize
        self.refresh_models()
    
    def setup_processing_graph(self):
        """Setup the LangGraph processing workflow"""
        def process_chunk(state: ProcessingState) -> ProcessingState:
            try:
                messages = [
                    {"role": "system", "content": "You are a valve specification analyzer. Extract structured information about valves from the text."},
                    *state["messages"],
                    {"role": "user", "content": f"Extract valve specifications from this text: {state['current_chunk']}"}
                ]
                
                response = ollama.chat(
                    messages=messages,
                    model=self.model_combo.currentText(),
                    format=ValveList.model_json_schema(),
                )
                
                # Add to conversation history
                state["messages"].append({"role": "user", "content": state["current_chunk"]})
                state["messages"].append({"role": "assistant", "content": response.message.content})
                state["chunks_processed"] += 1
                
                # Parse and store valves
                try:
                    valves = ValveList.model_validate_json(response.message.content)
                    state["extracted_valves"].extend([v.model_dump() for v in valves.valves])
                except Exception as e:
                    self.chat_text.append(f"Error parsing valve data: {str(e)}")
                
                return state
                
            except Exception as e:
                self.chat_text.append(f"Error processing chunk: {str(e)}")
                return state
        
        # Create the graph with state schema
        workflow = StateGraph(ProcessingState)
        
        # Add the processing node
        workflow.add_node("process_chunk", process_chunk)
        
        # Set the entry point
        workflow.set_entry_point("process_chunk")
        
        # Compile the graph
        self.graph = workflow.compile()
    
    def process_text(self):
        """Process the input text or Excel data with chunking"""
        try:
            # Get input based on current view
            if self.input_stack.currentWidget() == self.tree_widget:
                if self.current_df is None:
                    raise Exception("No Excel data loaded")
                input_text = self.current_df.to_string()
            else:
                input_text = self.input_text.toPlainText()
            
            if not input_text:
                QMessageBox.warning(self, "Error", "No input data")
                return
            
            # Split text into chunks
            chunks = self.text_splitter.split_text(input_text)
            
            # Update chat area
            self.chat_text.append(f"\nProcessing with model: {self.model_combo.currentText()}")
            self.chat_text.append(f"Split into {len(chunks)} chunks")
            
            # Show progress bar
            self.progress_bar.setVisible(True)
            self.progress_bar.setMaximum(len(chunks))
            self.progress_bar.setValue(0)
            
            # Initialize state for processing
            initial_state: ProcessingState = {
                "messages": [],
                "current_chunk": "",
                "chunks_processed": 0,
                "total_chunks": len(chunks),
                "extracted_valves": []
            }
            
            # Process chunks using the graph
            seen_serials = set()
            state = initial_state
            
            for i, chunk in enumerate(chunks):
                self.chat_text.append(f"\nProcessing chunk {i+1}/{len(chunks)}...")
                
                # Update state
                state["current_chunk"] = chunk
                
                # Run the graph
                result_state = self.graph.invoke(state)
                state = result_state  # Update state for next iteration
                
                # Update progress
                self.progress_bar.setValue(i + 1)
                QApplication.processEvents()
            
            # Deduplicate valves based on serial_id
            unique_valves = []
            for valve in state["extracted_valves"]:
                if valve["serial_id"] not in seen_serials:
                    unique_valves.append(valve)
                    seen_serials.add(valve["serial_id"])
            
            # Format final output
            final_result = {"valves": unique_valves}
            formatted_output = json.dumps(final_result, indent=2)
            self.output_text.setText(formatted_output)
            
            # Update chat
            self.chat_text.append("Processing complete!")
            self.progress_bar.setVisible(False)
            
        except Exception as e:
            error_msg = f"Error processing data: {str(e)}"
            self.chat_text.append(f"Error: {error_msg}")
            self.progress_bar.setVisible(False)
            QMessageBox.warning(self, "Error", error_msg)
    
    def clear_all(self):
        """Clear all areas and reset state"""
        self.input_text.clear()
        self.tree_widget.clear()
        self.output_text.clear()
        self.chat_text.clear()
        self.current_df = None
        self.progress_bar.setVisible(False)
    
    def update_tree_view(self, df):
        """Update TreeView with Excel data in table format"""
        self.tree_widget.clear()
        self.current_df = df
        
        # Set headers from DataFrame columns
        self.tree_widget.setHeaderLabels(list(df.columns))
        
        # Add data rows
        for idx, row in df.iterrows():
            item = QTreeWidgetItem()
            for col_idx, value in enumerate(row):
                item.setText(col_idx, str(value))
            self.tree_widget.addTopLevelItem(item)
        
        # Adjust column widths
        for i in range(len(df.columns)):
            self.tree_widget.resizeColumnToContents(i)
        
        # Switch to TreeView
        self.input_stack.setCurrentWidget(self.tree_widget)
        
        # Enable sorting
        self.tree_widget.setSortingEnabled(True)
    
    def load_file(self):
        """Load text or Excel file"""
        file_name, _ = QFileDialog.getOpenFileName(
            self, 
            "Open File", 
            "", 
            "Excel Files (*.xlsx *.xls);;Text Files (*.txt);;All Files (*)"
        )
        
        if file_name:
            try:
                if file_name.endswith(('.xlsx', '.xls')):
                    df = pd.read_excel(file_name)
                    self.update_tree_view(df)
                    self.chat_text.append(f"Loaded Excel file: {file_name}")
                else:
                    with open(file_name, 'r', encoding='utf-8') as file:
                        self.input_text.setText(file.read())
                        self.input_stack.setCurrentWidget(self.input_text)
                        self.chat_text.append(f"Loaded text file: {file_name}")
                
            except Exception as e:
                QMessageBox.warning(self, "Error", f"Error loading file: {str(e)}")
    
    def save_json(self):
        """Save results as JSON"""
        if not self.output_text.toPlainText():
            QMessageBox.warning(self, "Error", "No results to save")
            return
            
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            default_name = f"valve_specs_{timestamp}.json"
            file_name, _ = QFileDialog.getSaveFileName(
                self,
                "Save Results",
                default_name,
                "JSON Files (*.json);;All Files (*)"
            )
            
            if file_name:
                save_data = {
                    'timestamp': timestamp,
                    'model_used': self.model_combo.currentText(),
                    'chat_log': self.chat_text.toPlainText(),
                    'structured_output': json.loads(self.output_text.toPlainText())
                }
                
                with open(file_name, 'w', encoding='utf-8') as f:
                    json.dump(save_data, f, indent=2)
                    
                self.chat_text.append(f"\nResults saved to: {file_name}")
                
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Error saving results: {str(e)}")
    
    def save_excel(self):
        """Save results as Excel"""
        if not self.output_text.toPlainText():
            QMessageBox.warning(self, "Error", "No results to save")
            return
            
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            default_name = f"valve_specs_{timestamp}.xlsx"
            file_name, _ = QFileDialog.getSaveFileName(
                self,
                "Save Results",
                default_name,
                "Excel Files (*.xlsx);;All Files (*)"
            )
            
            if file_name:
                # Convert JSON output to DataFrame
                data = json.loads(self.output_text.toPlainText())
                df = pd.DataFrame(data['valves'])
                
                # Save to Excel
                df.to_excel(file_name, index=False)
                self.chat_text.append(f"\nResults saved to: {file_name}")
                
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Error saving results: {str(e)}")
    
    def refresh_models(self):
        """Refresh the list of available Ollama models"""
        try:
            url = 'http://localhost:11434/api/tags'
            response = requests.get(url)
            response.raise_for_status()
            
            self.model_combo.clear()
            models_data = response.json()
            if 'models' in models_data:
                model_names = [model['name'] for model in models_data['models']]
                self.model_combo.addItems(model_names)
                
                if model_names:
                    self.model_combo.setCurrentIndex(0)
                    self.chat_text.append(f"Available models: {', '.join(model_names)}")
                
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to get models: {str(e)}\nMake sure Ollama is running on http://localhost:11434")

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == '__main__':
    main()
