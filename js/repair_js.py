import os

def repair_mojibake(input_file, output_file):
    try:
        # 1. Read the file using 'latin-1' (which is how the garbled text is represented)
        with open(input_file, 'r', encoding='latin-1') as f:
            content = f.read()

        # 2. Convert the 'latin-1' string back to raw bytes, 
        #    then decode those bytes as 'utf-8' to get the correct Chinese
        repaired_content = content.encode('latin-1').decode('utf-8')

        # 3. Save the repaired content as a new .js file using UTF-8
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(repaired_content)
        
        print(f" Success! Repaired file saved as: {output_file}")

    except UnicodeEncodeError:
        print("Error: The file might not be in the expected garbled format.")
    except UnicodeDecodeError:
        print(" Error: Failed to decode as UTF-8. The file might be corrupted or in a different encoding.")
    except FileNotFoundError:
        print(f" Error: Could not find file '{input_file}'")
    except Exception as e:
        print(f" An unexpected error occurred: {e}")

# --- Settings ---
input_filename = "data_fixed.js"  # Put your garbled file name here
output_filename = "data_fixed1.js"

if __name__ == "__main__":
    repair_mojibake(input_filename, output_filename)