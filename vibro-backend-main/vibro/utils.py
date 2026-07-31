from django.conf import settings
from urllib.parse import urlparse, unquote
import json
import os


class UtilsFunctions:

    def upload_file_to_local(self, file_path: str, file_obj, content_type: str = None, bucket: str = None):
        """Upload file to local storage instead of S3"""
        try:
            print("DEBUG PATH:", file_path)
            print("DEBUG CONTENT TYPE:", content_type)

            if not file_obj:
                raise ValueError("No file provided for upload.")

            # Create directory if it doesn't exist
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            directory = os.path.dirname(full_path)
            os.makedirs(directory, exist_ok=True)

            # Save file locally
            with open(full_path, 'wb+') as destination:
                for chunk in file_obj.chunks():
                    destination.write(chunk)

            # Create URL for local file
            file_url = f"{settings.MEDIA_URL}{file_path}"
            print(f"DEBUG: File saved locally at {full_path}")
            print(f"DEBUG: File URL: {file_url}")
            return file_url

        except (ValueError, Exception) as e:
            print(f"Local Upload Error: {e}")
            return None
    
    def get_local_file_content(self, file_url: str):
        """Read file content from local storage"""
        try:
            # Extract file path from URL
            parsed = urlparse(file_url)
            relative_path = parsed.path.lstrip('/')
            local_file_path = os.path.join(settings.MEDIA_ROOT, relative_path.replace('media/', '', 1))

            print(f"DEBUG: Reading file from {local_file_path}")

            if not os.path.exists(local_file_path):
                return {"error": "File not found in local storage", "path": local_file_path}

            # Read file content
            with open(local_file_path, 'rb') as f:
                content = f.read()

            # Try to parse as JSON
            try:
                return json.loads(content.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                # Return raw content if not JSON
                return {"content": content, "is_binary": True}

        except Exception as e:
            return {"error": str(e)}

    def delete_local_file(self, file_name):
        """Delete file from local storage"""
        try:
            if not file_name:
                raise ValueError("Missing file name for deletion.")

            parsed_url = urlparse(file_name)
            relative_path = parsed_url.path.lstrip('/')
            local_file_path = os.path.join(settings.MEDIA_ROOT, relative_path.replace('media/', '', 1))

            print(f"DEBUG: Deleting file from {local_file_path}")

            if os.path.exists(local_file_path):
                os.remove(local_file_path)
                return {"success": True, "message": "File deleted successfully!"}
            else:
                return {"success": False, "error": "File not found", "path": local_file_path}

        except ValueError as ve:
            return {"success": False, "error": str(ve), "type": "ValueError"}

        except Exception as e:
            return {"success": False, "error": str(e), "type": e.__class__.__name__}

    # Keep old S3 methods for backward compatibility but mark as deprecated
    def upload_file_to_s3(self, file_path: str, file_obj, content_type: str = None, bucket: str = None):
        """Deprecated: Use upload_file_to_local instead"""
        return self.upload_file_to_local(file_path, file_obj, content_type, bucket)
    
    def get_s3_form_payload_with_url(self, file_url: str, bucket: str = None):
        """Deprecated: Use get_local_file_content instead"""
        return self.get_local_file_content(file_url)

    def delete_file_from_s3(self, file_name, bucket: str = None):
        """Deprecated: Use delete_local_file instead"""
        return self.delete_local_file(file_name)

    def extract_error_message(self, exc):
        if isinstance(exc, dict):
            messages = []
            for key, value in exc.items():
                messages.append(self.extract_error_message(value))
            return " ".join(messages)

        if isinstance(exc, list):
            return " ".join([self.extract_error_message(item) for item in exc])

        return str(exc)
