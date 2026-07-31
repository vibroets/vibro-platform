#!/usr/bin/env python3
"""
API Performance Testing Script

This script compares the performance of old vs optimized API endpoints.
It measures:
- Response time
- Query count
- Data consistency

Usage:
    python test_api_performance.py --token YOUR_JWT_TOKEN
    python test_api_performance.py --token YOUR_JWT_TOKEN --base-url http://production.com/api
"""

import argparse
import requests
import time
import json
from typing import Dict, Tuple, List
from dataclasses import dataclass
from datetime import datetime


@dataclass
class PerformanceResult:
    """Store performance test results"""
    endpoint: str
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    query_count: str
    status_code: int
    response_size: int
    error: str = None


class APIPerformanceTester:
    """Test API endpoint performance"""
    
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.headers = {"Authorization": f"Bearer {token}"}
        self.results: Dict[str, Tuple[PerformanceResult, PerformanceResult]] = {}
    
    def test_endpoint(
        self, 
        name: str, 
        path: str, 
        iterations: int = 5,
        warm_up: bool = True
    ) -> PerformanceResult:
        """Test a single endpoint multiple times"""
        
        url = f"{self.base_url}{path}"
        
        # Warm up
        if warm_up:
            try:
                requests.get(url, headers=self.headers, timeout=30)
            except Exception:
                pass
        
        # Test multiple times
        times = []
        status_codes = []
        query_counts = []
        response_sizes = []
        last_response = None
        
        print(f"\n  Testing {name}...", end=" ")
        
        for i in range(iterations):
            try:
                start = time.time()
                response = requests.get(url, headers=self.headers, timeout=30)
                duration = time.time() - start
                
                times.append(duration)
                status_codes.append(response.status_code)
                query_counts.append(response.headers.get('X-DB-Query-Count', 'N/A'))
                response_sizes.append(len(response.content))
                last_response = response
                
                print(".", end="", flush=True)
                
            except Exception as e:
                print(f"\n  ❌ Error: {str(e)}")
                return PerformanceResult(
                    endpoint=name,
                    avg_response_time=0,
                    min_response_time=0,
                    max_response_time=0,
                    query_count="N/A",
                    status_code=0,
                    response_size=0,
                    error=str(e)
                )
        
        print(" ✓")
        
        return PerformanceResult(
            endpoint=name,
            avg_response_time=sum(times) / len(times),
            min_response_time=min(times),
            max_response_time=max(times),
            query_count=query_counts[0],
            status_code=status_codes[0],
            response_size=response_sizes[0],
            error=None
        )
    
    def compare_endpoints(
        self, 
        name: str, 
        old_path: str, 
        new_path: str,
        iterations: int = 5
    ):
        """Compare old vs new endpoint"""
        
        print(f"\n{'='*70}")
        print(f"🧪 Testing: {name}")
        print('='*70)
        
        # Test old endpoint
        print("\n📍 OLD endpoint:")
        old_result = self.test_endpoint(f"{name} (Old)", old_path, iterations)
        
        # Test new endpoint
        print("\n📍 NEW endpoint:")
        new_result = self.test_endpoint(f"{name} (New)", new_path, iterations)
        
        # Store results
        self.results[name] = (old_result, new_result)
        
        # Print comparison
        self._print_comparison(old_result, new_result)
    
    def _print_comparison(self, old: PerformanceResult, new: PerformanceResult):
        """Print comparison between old and new results"""
        
        if old.error or new.error:
            print(f"\n  ⚠️  Errors occurred during testing")
            if old.error:
                print(f"     Old endpoint error: {old.error}")
            if new.error:
                print(f"     New endpoint error: {new.error}")
            return
        
        # Calculate improvements
        time_improvement = ((old.avg_response_time - new.avg_response_time) 
                           / old.avg_response_time * 100) if old.avg_response_time > 0 else 0
        
        try:
            old_queries = int(old.query_count) if old.query_count != 'N/A' else 0
            new_queries = int(new.query_count) if new.query_count != 'N/A' else 0
            query_reduction = old_queries - new_queries
            query_improvement = (query_reduction / old_queries * 100) if old_queries > 0 else 0
        except:
            old_queries = new_queries = query_reduction = query_improvement = 0
        
        # Print results
        print(f"\n  📊 Results:")
        print(f"     Response Time:")
        print(f"       Old: {old.avg_response_time:.3f}s (min: {old.min_response_time:.3f}s, max: {old.max_response_time:.3f}s)")
        print(f"       New: {new.avg_response_time:.3f}s (min: {new.min_response_time:.3f}s, max: {new.max_response_time:.3f}s)")
        print(f"       Improvement: {time_improvement:+.1f}%")
        
        if old_queries > 0 or new_queries > 0:
            print(f"\n     Query Count:")
            print(f"       Old: {old.query_count} queries")
            print(f"       New: {new.query_count} queries")
            print(f"       Reduction: {query_reduction} queries ({query_improvement:.1f}%)")
        
        print(f"\n     Response Size: {new.response_size:,} bytes")
        print(f"     Status Code: {new.status_code}")
        
        # Success indicators
        if time_improvement > 50:
            print(f"\n  ✅ Excellent improvement!")
        elif time_improvement > 20:
            print(f"\n  ✅ Good improvement!")
        elif time_improvement > 0:
            print(f"\n  ✅ Slight improvement")
        else:
            print(f"\n  ⚠️  Performance did not improve")
    
    def generate_report(self):
        """Generate final summary report"""
        
        print(f"\n{'='*70}")
        print("📊 FINAL PERFORMANCE REPORT")
        print('='*70)
        
        # Calculate overall statistics
        total_tests = len(self.results)
        improved_tests = 0
        total_time_saved = 0
        total_queries_reduced = 0
        
        print(f"\n{'Endpoint':<30} {'Old Time':<12} {'New Time':<12} {'Improvement'}")
        print('-'*70)
        
        for name, (old, new) in self.results.items():
            if old.error or new.error:
                print(f"{name:<30} {'ERROR':<12} {'ERROR':<12} {'N/A'}")
                continue
            
            time_improvement = ((old.avg_response_time - new.avg_response_time) 
                               / old.avg_response_time * 100) if old.avg_response_time > 0 else 0
            
            if time_improvement > 0:
                improved_tests += 1
            
            time_saved = old.avg_response_time - new.avg_response_time
            total_time_saved += time_saved
            
            try:
                old_queries = int(old.query_count) if old.query_count != 'N/A' else 0
                new_queries = int(new.query_count) if new.query_count != 'N/A' else 0
                total_queries_reduced += (old_queries - new_queries)
            except:
                pass
            
            print(f"{name:<30} {old.avg_response_time:>10.3f}s {new.avg_response_time:>10.3f}s {time_improvement:>9.1f}%")
        
        # Summary
        print('\n' + '='*70)
        print(f"Summary:")
        print(f"  Total endpoints tested: {total_tests}")
        print(f"  Endpoints improved: {improved_tests}/{total_tests}")
        print(f"  Total time saved per request: {total_time_saved:.3f}s")
        print(f"  Total queries reduced: {total_queries_reduced}")
        print('='*70)
        
        # Save to file
        self._save_report()
    
    def _save_report(self):
        """Save report to JSON file"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"performance_report_{timestamp}.json"
        
        report_data = {
            "timestamp": timestamp,
            "base_url": self.base_url,
            "results": {}
        }
        
        for name, (old, new) in self.results.items():
            report_data["results"][name] = {
                "old": {
                    "avg_time": old.avg_response_time,
                    "query_count": old.query_count,
                    "status_code": old.status_code,
                    "error": old.error
                },
                "new": {
                    "avg_time": new.avg_response_time,
                    "query_count": new.query_count,
                    "status_code": new.status_code,
                    "error": new.error
                }
            }
        
        with open(filename, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\n📄 Report saved to: {filename}")


def main():
    """Main function"""
    
    parser = argparse.ArgumentParser(description='Test API performance')
    parser.add_argument('--token', required=True, help='JWT authentication token')
    parser.add_argument('--base-url', default='http://127.0.0.1:8000/api', 
                       help='Base API URL (default: http://127.0.0.1:8000/api)')
    parser.add_argument('--iterations', type=int, default=5,
                       help='Number of test iterations per endpoint (default: 5)')
    parser.add_argument('--user-id', type=int, default=1,
                       help='User ID for detail endpoint tests (default: 1)')
    parser.add_argument('--org-id', type=int, default=1,
                       help='Organization ID for detail endpoint tests (default: 1)')
    
    args = parser.parse_args()
    
    print("="*70)
    print("🚀 API PERFORMANCE TEST")
    print("="*70)
    print(f"Base URL: {args.base_url}")
    print(f"Iterations per endpoint: {args.iterations}")
    print("="*70)
    
    tester = APIPerformanceTester(args.base_url, args.token)
    
    # Test all endpoints
    tester.compare_endpoints(
        "Users List",
        "/users/list",
        "/users/list/v2",
        args.iterations
    )
    
    tester.compare_endpoints(
        "User Detail",
        f"/users/{args.user_id}",
        f"/users/{args.user_id}/v2",
        args.iterations
    )
    
    tester.compare_endpoints(
        "Groups List",
        "/groups/",
        "/groups/v2/",
        args.iterations
    )
    
    tester.compare_endpoints(
        "Organization List",
        "/organization/list",
        "/organization/list/v2",
        args.iterations
    )
    
    tester.compare_endpoints(
        "Organization Detail",
        f"/organization/{args.org_id}",
        f"/organization/{args.org_id}/v2",
        args.iterations
    )
    
    # Generate final report
    tester.generate_report()


if __name__ == "__main__":
    main()


