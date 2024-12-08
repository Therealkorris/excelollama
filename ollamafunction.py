import sys
import json
from datetime import datetime
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QPushButton, QTextEdit, QLabel, 
                            QFileDialog, QComboBox, QMessageBox)
from PyQt6.QtCore import Qt
import pandas as pd
import ollama
from pydantic import BaseModel
from typing import List, Optional, Dict

class Valve(BaseModel):
    valve_type: str
    serial_id: str
    width: float | None
    height: float | None
    pressure_rating: str | None
    material: str | None
    manufacturer: str | None

class ValveList(BaseModel):
    valves: List[Valve]

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Valve Specification Extractor")
        self.setMinimumSize(1200, 800)
        
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
        
        # Input area
        self.input_label = QLabel("Input Text:")
        self.input_text = QTextEdit()
        left_layout.addWidget(self.input_label)
        left_layout.addWidget(self.input_text)
        
        # Buttons
        button_layout = QHBoxLayout()
        self.load_file_btn = QPushButton("Load File")
        self.process_btn = QPushButton("Process Text")
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
        
        # Save button
        self.save_btn = QPushButton("Save Results")
        right_layout.addWidget(self.save_btn)
        
        # Add panels to main layout
        layout.addWidget(left_panel)
        layout.addWidget(right_panel)
        
        # Connect signals
        self.load_file_btn.clicked.connect(self.load_file)
        self.process_btn.clicked.connect(self.process_text)
        self.clear_btn.clicked.connect(self.clear_all)
        self.save_btn.clicked.connect(self.save_results)
        self.refresh_models_btn.clicked.connect(self.refresh_models)
        
        # Initialize
        self.refresh_models()
        
    def refresh_models(self):
        """Refresh the list of available Ollama models"""
        try:
            # Get list of models from Ollama API
            url = 'http://localhost:11434/api/tags'
            import requests
            response = requests.get(url)
            response.raise_for_status()
            
            # Update combo box with available models
            self.model_combo.clear()
            models_data = response.json()
            if 'models' in models_data:
                model_names = [model['name'] for model in models_data['models']]
                self.model_combo.addItems(model_names)
                
                # Set the first available model as default if any exist
                if model_names:
                    self.model_combo.setCurrentIndex(0)
                    self.chat_text.append(f"Available models: {', '.join(model_names)}")
                
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to get models: {str(e)}\nMake sure Ollama is running on http://localhost:11434")
    
    def load_file(self):
        """Load text or Excel file"""
        file_name, _ = QFileDialog.getOpenFileName(
            self, 
            "Open File", 
            "", 
            "Text Files (*.txt);;Excel Files (*.xlsx *.xls);;All Files (*)"
        )
        
        if file_name:
            try:
                if file_name.endswith(('.xlsx', '.xls')):
                    df = pd.read_excel(file_name)
                    self.input_text.setText("\n".join(df.iloc[:, 0].astype(str).tolist()))
                else:
                    with open(file_name, 'r', encoding='utf-8') as file:
                        self.input_text.setText(file.read())
                        
                self.chat_text.append(f"Loaded file: {file_name}")
                
            except Exception as e:
                QMessageBox.warning(self, "Error", f"Error loading file: {str(e)}")
    
    def process_text(self):
        """Process the input text using selected model"""
        input_text = self.input_text.toPlainText()
        if not input_text:
            QMessageBox.warning(self, "Error", "Please enter some text to process")
            return
        
        try:
            model = self.model_combo.currentText()
            
            # Update chat area
            self.chat_text.append(f"\nProcessing with model: {model}")
            self.chat_text.append("Input text:")
            self.chat_text.append(input_text)
            self.chat_text.append("\nProcessing...")
            
            # Get response from Ollama
            response = ollama.chat(
                messages=[{
                    'role': 'user',
                    'content': input_text,
                }],
                model=model,
                format=ValveList.model_json_schema(),
            )
            
            # Parse and validate
            valves = ValveList.model_validate_json(response.message.content)
            
            # Format output
            formatted_output = json.dumps(json.loads(valves.model_dump_json()), indent=2)
            self.output_text.setText(formatted_output)
            
            # Update chat
            self.chat_text.append("Processing complete!")
            
        except Exception as e:
            error_msg = f"Error processing text: {str(e)}"
            self.chat_text.append(f"Error: {error_msg}")
            if 'response' in locals():
                self.chat_text.append(f"Raw response: {response.message.content}")
            QMessageBox.warning(self, "Error", error_msg)
    
    def save_results(self):
        """Save both chat log and structured output"""
        if not self.output_text.toPlainText() and not self.chat_text.toPlainText():
            QMessageBox.warning(self, "Error", "No results to save")
            return
            
        try:
            # Get save file name
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            default_name = f"valve_specs_{timestamp}.json"
            file_name, _ = QFileDialog.getSaveFileName(
                self,
                "Save Results",
                default_name,
                "JSON Files (*.json);;Text Files (*.txt);;All Files (*)"
            )
            
            if file_name:
                # Prepare data to save
                save_data = {
                    'timestamp': timestamp,
                    'model_used': self.model_combo.currentText(),
                    'chat_log': self.chat_text.toPlainText(),
                    'structured_output': json.loads(self.output_text.toPlainText()) if self.output_text.toPlainText() else None
                }
                
                # Save to file
                with open(file_name, 'w', encoding='utf-8') as f:
                    json.dump(save_data, f, indent=2)
                    
                self.chat_text.append(f"\nResults saved to: {file_name}")
                
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Error saving results: {str(e)}")
    
    def clear_all(self):
        """Clear all text areas"""
        self.input_text.clear()
        self.output_text.clear()
        self.chat_text.clear()

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == '__main__':
    main()
