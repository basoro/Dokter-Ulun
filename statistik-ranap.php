<?php include_once ('layout/header.php'); ?>

        <?php
            if(isset($_GET['tahun'])) { $tahun = $_GET['tahun']; } else { $tahun = date("Y"); };
        ?>

  <section class="content">
      <div class="container-fluid">
          <div class="block-header">
              <h2>STATISTIK PASIEN <?php echo "Periode ".$tahun; ?></h2>
          </div>
        <!-- CPU Usage -->
          <div class="row clearfix">
              <div class="col-xs-12 col-sm-12 col-md-12 col-lg-12">
                  <div class="card">
                      <div class="header">
                          <div class="row clearfix">
                              <div class="col-xs-12 col-sm-6">
                                  <h2>GRAFIK RAWAT INAP</h2>
                              </div>
                          </div>
                      </div>
                      <div class="body">
                      <?php
          $jumlah=array();
          $penyakit=array();
          $kd_penyakit=array();
                      $sql = "SELECT MONTHNAME (reg_periksa.tgl_registrasi) as bulan, COUNT(DISTINCT  dpjp_ranap.no_rawat) as jumlah FROM dpjp_ranap, reg_periksa WHERE dpjp_ranap.kd_dokter = '{$_SESSION['username']}' AND reg_periksa.tgl_registrasi LIKE '$tahun%' AND reg_periksa.status_lanjut = 'Ranap' AND reg_periksa.no_rawat = dpjp_ranap.no_rawat GROUP BY MONTH(reg_periksa.tgl_registrasi)";
          $hasil=query($sql);
          while ($data = fetch_array ($hasil)){
                          $ranap_jumlah[]=intval($data['jumlah']);
                          $ranap_bulan[]=$data['bulan'];
                      }
          ?>
                              <div id="pasien_ranap">
                              </div>
                      </div>
                  </div>

                  <div class="card">
                      <div class="header">
                          <div class="row clearfix">
                              <div class="col-xs-12 col-sm-6">
                                  <h2>DETAIL RAWAT INAP</h2>
                              </div>
                          </div>
                          <ul class="header-dropdown m-r--5">
                            <li class="dropdown">
                              <a href="javascript:void(0);" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
                                <i class="material-icons">more_vert</i>
                              </a>
                              <ul class="dropdown-menu pull-right">
                                <li><a href="javascript:void(0);" onclick="printDiv('printMe')">Print</a></li>
                              </ul>
                            </li>
                          </ul>
                      </div>
                      <div class="body" id="printMe">
                          <table class="table table-bordered table-striped table-hover display nowrap">
                              <thead>
                                  <tr>
                                      <th>Bulan</th>
                                      <th>Jumlah</th>
                                  </tr>
                              </thead>
                              <tbody>
                              <?php
                              $sql = "SELECT MONTHNAME (reg_periksa.tgl_registrasi) as Bulan, COUNT(DISTINCT  dpjp_ranap.no_rawat) as Jumlah FROM dpjp_ranap, reg_periksa WHERE dpjp_ranap.kd_dokter = '{$_SESSION['username']}' AND reg_periksa.tgl_registrasi LIKE '$tahun%' AND reg_periksa.status_lanjut = 'Ranap' AND reg_periksa.no_rawat = dpjp_ranap.no_rawat GROUP BY MONTH(reg_periksa.tgl_registrasi)";
                              $query = query($sql);
                              while($row = fetch_array($query)) {
                              ?>
                                  <tr>
                                      <td><?php echo $row['0']; ?></td>
                                      <td><?php echo $row['1']; ?></td>
                                  </tr>
                              <?php
                              }
                              ?>
                              </tbody>
                          </table>
                      </div>
                  </div>

              </div>
          </div>
          <!-- #END# CPU Usage -->
    <div class="row clearfix">
              <!-- Line Chart -->
                          <form method="get" action="">
                            <div class="col-lg-8">
                            <select name="tahun" class="form-control">
                              <option value="2016">2016</option>
                              <option value="2017">2017</option>
                              <option value="2018">2018</option>
                              <option value="2019">2019</option>
                              <option value="2020" selected>2020</option>
                            </select>
                      </div>
                          <div class="col-lg-4">
                            <input type="submit" class="btn bg-blue btn-block btn-lg waves-effect" value="Submit">
                          </div>
                          </form>
        </div>
        <div class="row clearfix">
          <br><br>
        </div>


      </div>
  </section>

<?php include_once ('layout/footer.php'); ?>
  <!-- Morris Plugin Js -->
  <script src="plugins/raphael/raphael.min.js"></script>
  <script src="plugins/morrisjs/morris.js"></script>

<script type="text/javascript">
      Highcharts.chart('pasien_ranap', {
      chart: {
        type: 'column'
    },
          exporting: {
              enabled: false
          },
      title: {
        text: 'Pasien Rawat Inap <?php echo ucwords(strtolower($dataGet['0'])); ?>'
    },
    subtitle: {
      text: <?=json_encode($tahun);?>
    },
      xAxis: {
          categories: <?=json_encode($ranap_bulan);?> ,

      title: {
          enabled: false
      }
    },
    yAxis: {
      title: {
        text: 'Jumlah Pasien'
      },
      labels: {
        formatter: function () {
          return this.value;
        }
      }
    },
    tooltip: {
      split: true,
      valueSuffix: ''
    },
    plotOptions: {
      area: {
      stacking: 'normal',
      lineColor: '#666666',
      lineWidth: 1,
          marker: {
          lineWidth: 1,
          lineColor: '#666666'
        }
      }
    },
    series: [{
      name: 'Jumlah Kunjungan',
      data: <?=json_encode($ranap_jumlah);?>
    }]
  });
</script>

<script>
  function printDiv(divName){
    var printContents = document.getElementById(divName).innerHTML;
    var originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
  }
</script>
