// Google Apps Script for Campus Assistant Portal
// Deploy this as a Web App to handle Google Sheets operations

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // Get your Google Sheet by ID
    const SHEET_ID = 'your_google_sheet_id_here'; // Replace with your Sheet ID
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    switch (action) {
      case 'append':
        return appendToSheet(ss, data.sheetName, data.values);
      case 'read':
        return readFromSheet(ss, data.sheetName, data.range);
      default:
        return ContentService.createTextOutput(JSON.stringify({error: 'Unknown action'}));
    }
  } catch (error) {
    console.error('Error:', error);
    return ContentService.createTextOutput(JSON.stringify({error: error.message}));
  }
}

function appendToSheet(spreadsheet, sheetName, values) {
  try {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    sheet.appendRow(values);
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true, message: 'Row appended successfully'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Append error:', error);
    return ContentService
      .createTextOutput(JSON.stringify({error: error.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function readFromSheet(spreadsheet, sheetName, range) {
  try {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    const dataRange = range ? sheet.getRange(range) : sheet.getDataRange();
    const values = dataRange.getValues();
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true, values: values}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('Read error:', error);
    return ContentService
      .createTextOutput(JSON.stringify({error: error.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function - you can run this to verify the script works
function testScript() {
  const SHEET_ID = 'your_google_sheet_id_here';
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Test append
  const result = appendToSheet(ss, 'chat_logs', [
    new Date().toISOString(),
    'test@example.com',
    'Test User',
    'Test question',
    'test-model',
    'success',
    'Test response',
    '<p>Test HTML response</p>',
    'No links',
    ''
  ]);
  
  console.log('Test result:', result.getContent());
}

/*
Setup Instructions:
1. Create a new Google Apps Script project at script.google.com
2. Replace the default code with this script
3. Replace 'your_google_sheet_id_here' with your actual Sheet ID
4. Deploy as Web App:
   - Click "Deploy" > "New deployment"
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone (for public use)
5. Copy the Web App URL and add it to your .dev.vars as GOOGLE_APPS_SCRIPT_URL
6. Make sure your Google Sheet has these tabs with headers:
   
   chat_logs:
   timestamp | user_email | user_name | question | model_used | status | raw_response | final_answer_html | source_links | error
   
   events:
   id | title | description | date_iso | location | rsvp_form | visible | created_at
   
   notices:
   id | title | body_html | category | posted_at_iso | visible | created_at
   
   registrations:
   id | event_id | name | email | phone | department | year | additional_info | created_at_iso
*/